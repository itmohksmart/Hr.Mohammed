-- HR & Payroll Management System Schema

-- 1. Locations Table
CREATE TABLE locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    allowed_radius INTEGER DEFAULT 100, -- in meters
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE smart_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius INTEGER DEFAULT 100, -- in meters
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Employee to Smart Locations assignment (optional, for now we will check all active ones or we can link them)
-- For simplicity and meeting the user's "multiple locations" request, we'll allow any active smart location globally for now, 
-- or we can add a mapping table if needed later.

-- 2. Employees Table
CREATE TABLE employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    department TEXT,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    job_title TEXT,
    hire_date DATE DEFAULT CURRENT_DATE,
    salary DECIMAL(12, 2) DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'probation')),
    attendance_method TEXT DEFAULT 'gps', -- 'gps', 'gps_photo', 'gps_biometric'
    termination_date DATE,
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),
    last_location_update TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Employee to Smart Locations mapping
CREATE TABLE employee_smart_locations (
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    smart_location_id UUID REFERENCES smart_locations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (employee_id, smart_location_id)
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage system settings" ON public.system_settings FOR ALL USING (public.check_is_admin() OR public.check_is_hr());

-- 3. Shifts Table
CREATE TABLE shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    check_in_grace INTEGER DEFAULT 15,
    check_out_grace INTEGER DEFAULT 15,
    work_days INTEGER[] DEFAULT '{0,1,2,3,4,6}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Attendance Table
CREATE TABLE attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    check_in TIME,
    check_out TIME,
    check_in_photo TEXT,
    check_out_photo TEXT,
    status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'leave', 'missing_checkout', 'missing_checkin', 'time_off', 'late', 'holiday')),
    late_minutes INTEGER DEFAULT 0,
    early_exit_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(employee_id, date)
);

-- 4. Leaves Table
CREATE TABLE leaves (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sick', 'regular', 'unpaid', 'other')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 5. Payroll Table
CREATE TABLE payroll (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    base_salary DECIMAL(12, 2) NOT NULL,
    bonuses DECIMAL(12, 2) DEFAULT 0,
    deductions DECIMAL(12, 2) DEFAULT 0,
    net_salary DECIMAL(12, 2) NOT NULL,
    deduction_reasons JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(employee_id, month, year)
);

-- 1. Ensure the user_roles table exists
DROP TABLE IF EXISTS public.users CASCADE; -- Safety drop for any manual table named 'users' that might conflict

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID UNIQUE, -- Removed FK to auth.users to avoid common Supabase permission issues in restricted environments
    role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'hr', 'employee', 'sector_manager')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Ensure RLS is enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Fix Role Checking Functions (Simplify and Hardcoded Bootstrap)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  current_email TEXT;
BEGIN
  current_email := auth.jwt() ->> 'email';
  
  -- 1. Hardcoded Super Admins (Fastest check)
  IF current_email IN ('dorgamaltabi@gmail.com', 'mohammedaltai7227@gmail.com') THEN
    RETURN TRUE;
  END IF;

  -- 2. Check by roles table
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_is_hr()
RETURNS BOOLEAN AS $$
DECLARE
  current_email TEXT;
BEGIN
  current_email := auth.jwt() ->> 'email';
  
  -- Super Admins are also HR
  IF current_email IN ('dorgamaltabi@gmail.com', 'mohammedaltai7227@gmail.com') THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr')
  );
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_is_sector_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'sector_manager'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_auth_user_location()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT location_id FROM public.employees 
    WHERE email = auth.jwt() ->> 'email'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(_email TEXT)
RETURNS UUID AS $$
DECLARE
  uid UUID;
BEGIN
  -- We use EXECUTE to avoid compile-time dependency on auth.users if it's restricted
  EXECUTE 'SELECT id FROM auth.users WHERE email = $1 LIMIT 1' INTO uid USING _email;
  RETURN uid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 8. Notifications Table
DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID, -- Removed FK to auth.users
    target_role TEXT, -- To notify all admins, hr, etc.
    employee_id UUID, -- Optional specific employee
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications 
FOR SELECT TO authenticated 
USING (
  user_id = auth.uid() OR 
  target_role IN (SELECT role FROM user_roles WHERE user_id = auth.uid()) OR
  (employee_id = (SELECT id FROM employees WHERE email = auth.jwt() ->> 'email' LIMIT 1)) OR
  target_role = 'all'
);

CREATE POLICY "Users can manage their own notifications" ON public.notifications FOR ALL USING (true);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);


-- Policies for user_roles
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;
CREATE POLICY "Users can view their own role" ON user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON user_roles FOR ALL TO authenticated USING (
    (auth.jwt() ->> 'email' IN ('dorgamaltabi@gmail.com', 'mohammedaltai7227@gmail.com')) OR
    public.check_is_admin()
);

-- Locations Policies
DROP POLICY IF EXISTS "Admin/HR can manage locations" ON locations;
DROP POLICY IF EXISTS "Employees can view locations" ON locations;
CREATE POLICY "Admin/HR can manage locations" ON locations FOR ALL TO authenticated USING (public.check_is_admin() OR public.check_is_hr());
CREATE POLICY "Employees can view locations" ON locations FOR SELECT TO authenticated USING (true);

-- Employees Policies
DROP POLICY IF EXISTS "Admin/HR can manage employees" ON employees;
DROP POLICY IF EXISTS "Sector managers can view employees in their location" ON employees;
DROP POLICY IF EXISTS "Employees can view their own profile" ON employees;
CREATE POLICY "Admin/HR can manage employees" ON employees FOR ALL TO authenticated USING (
    (auth.jwt() ->> 'email' IN ('dorgamaltabi@gmail.com', 'mohammedaltai7227@gmail.com')) OR
    public.check_is_admin() OR 
    public.check_is_hr()
);
CREATE POLICY "Sector managers can view employees in their location" ON employees FOR SELECT TO authenticated USING (
    public.check_is_sector_manager() AND location_id = public.get_auth_user_location()
);
CREATE POLICY "Employees can view their own profile" ON employees FOR SELECT TO authenticated USING (
    email = auth.jwt() ->> 'email'
);

-- Attendance Policies
DROP POLICY IF EXISTS "Admin/HR can manage attendance" ON attendance;
DROP POLICY IF EXISTS "Sector managers can manage attendance in their location" ON attendance;
DROP POLICY IF EXISTS "Employees can view their own attendance" ON attendance;
CREATE POLICY "Admin/HR can manage attendance" ON attendance FOR ALL TO authenticated USING (public.check_is_admin() OR public.check_is_hr());
CREATE POLICY "Sector managers can manage attendance in their location" ON attendance FOR ALL TO authenticated USING (
    public.check_is_sector_manager() AND employee_id IN (
        SELECT id FROM employees WHERE location_id = public.get_auth_user_location()
    )
);
CREATE POLICY "Employees can view their own attendance" ON attendance FOR SELECT TO authenticated USING (
    employee_id IN (SELECT id FROM employees WHERE email = auth.jwt() ->> 'email')
);

-- Leaves Policies
DROP POLICY IF EXISTS "Admin/HR can manage all leaves" ON leaves;
DROP POLICY IF EXISTS "Sector managers can manage leaves in their location" ON leaves;
DROP POLICY IF EXISTS "Employees can manage their own leaves" ON leaves;
CREATE POLICY "Admin/HR can manage all leaves" ON leaves FOR ALL TO authenticated USING (public.check_is_admin() OR public.check_is_hr());
CREATE POLICY "Sector managers can manage leaves in their location" ON leaves FOR ALL TO authenticated USING (
    public.check_is_sector_manager() AND employee_id IN (
        SELECT id FROM employees WHERE location_id = public.get_auth_user_location()
    )
);
CREATE POLICY "Employees can manage their own leaves" ON leaves FOR ALL TO authenticated USING (
    employee_id IN (SELECT id FROM employees WHERE email = auth.jwt() ->> 'email')
);

-- Payroll Policies
DROP POLICY IF EXISTS "Admin can manage payroll" ON payroll;
DROP POLICY IF EXISTS "HR can view payroll" ON payroll;
DROP POLICY IF EXISTS "Employees can view their own payroll" ON payroll;
CREATE POLICY "Admin can manage payroll" ON payroll FOR ALL TO authenticated USING (public.check_is_admin());
CREATE POLICY "HR can view payroll" ON payroll FOR SELECT TO authenticated USING (public.check_is_hr());
CREATE POLICY "Employees can view their own payroll" ON payroll FOR SELECT TO authenticated USING (
    employee_id IN (SELECT id FROM employees WHERE email = auth.jwt() ->> 'email')
);

-- 6. Shifts Policies
DROP POLICY IF EXISTS "Admin/HR can manage shifts" ON shifts;
DROP POLICY IF EXISTS "Employees can view shifts" ON shifts;
CREATE POLICY "Admin/HR can manage shifts" ON shifts FOR ALL TO authenticated USING (public.check_is_admin() OR public.check_is_hr());
CREATE POLICY "Employees can view shifts" ON shifts FOR SELECT TO authenticated USING (true);

-- 7. Org Charts Table (Main Container)
CREATE TABLE IF NOT EXISTS public.org_charts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 8. Org Nodes Table
CREATE TABLE IF NOT EXISTS public.org_nodes (
    id TEXT PRIMARY KEY,
    chart_id UUID REFERENCES public.org_charts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('department', 'role', 'person', 'empty')),
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    parent_id TEXT REFERENCES public.org_nodes(id) ON DELETE CASCADE,
    color TEXT,
    display_order INTEGER DEFAULT 0,
    shift_info TEXT,
    layout TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- RLS for Org Charts
ALTER TABLE public.org_charts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view charts" ON public.org_charts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/HR can manage charts" ON public.org_charts FOR ALL TO authenticated USING (public.check_is_admin() OR public.check_is_hr());

-- Org Chart Nodes Policies
ALTER TABLE public.org_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin/HR can manage org chart" ON public.org_nodes;
CREATE POLICY "Admin/HR can manage org chart" ON public.org_nodes 
FOR ALL 
TO authenticated
USING (
    (auth.jwt() ->> 'email' IN ('dorgamaltabi@gmail.com', 'mohammedaltai7227@gmail.com')) OR
    public.check_is_admin() OR 
    public.check_is_hr()
)
WITH CHECK (true);

DROP POLICY IF EXISTS "Viewing org chart" ON public.org_nodes;
CREATE POLICY "Viewing org chart" ON public.org_nodes 
FOR SELECT 
TO authenticated
USING (true);

-- 9. Explicitly grant permissions to standard roles to avoid "permission denied"
-- This ensures the 'authenticated', 'anon', and 'service_role' roles have access
-- as required by Supabase's "Data API" changes.

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Special limited access for anon (optional, usually login related info)
GRANT SELECT ON public.system_settings TO anon;
GRANT SELECT ON public.user_roles TO anon;

-- Ensure all tables have RLS enabled and accessible
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_smart_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- 10. Rewards Table
CREATE TABLE IF NOT EXISTS public.rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Rewards Policies
DROP POLICY IF EXISTS "Admin/HR can manage rewards" ON public.rewards;
DROP POLICY IF EXISTS "Employees can view their own rewards" ON public.rewards;

CREATE POLICY "Admin/HR can manage rewards" ON public.rewards 
FOR ALL 
TO authenticated 
USING (
    (auth.jwt() ->> 'email' IN ('dorgamaltabi@gmail.com', 'mohammedaltai7227@gmail.com')) OR
    public.check_is_admin() OR 
    public.check_is_hr()
)
WITH CHECK (true);

CREATE POLICY "Employees can view their own rewards" ON public.rewards 
FOR SELECT 
TO authenticated 
USING (
    employee_id IN (SELECT id FROM public.employees WHERE email = auth.jwt() ->> 'email')
);

GRANT ALL ON TABLE public.rewards TO authenticated;
GRANT ALL ON TABLE public.rewards TO service_role;
