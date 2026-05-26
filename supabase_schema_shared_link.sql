CREATE TABLE IF NOT EXISTS public.shared_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chart_id UUID REFERENCES public.org_charts(id) ON DELETE CASCADE,
    password TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_by TEXT
);

ALTER TABLE public.shared_charts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin/HR can manage shared charts" ON public.shared_charts;
CREATE POLICY "Admin/HR can manage shared charts" ON public.shared_charts
FOR ALL TO authenticated
USING (
    (auth.jwt() ->> 'email' IN ('dorgamaltabi@gmail.com', 'mohammedaltai7227@gmail.com')) OR
    public.check_is_admin() OR 
    public.check_is_hr()
) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read shared charts" ON public.shared_charts;
CREATE POLICY "Anyone can read shared charts" ON public.shared_charts
FOR SELECT TO anon, authenticated
USING (true);

GRANT ALL ON TABLE public.shared_charts TO authenticated;
GRANT SELECT ON TABLE public.shared_charts TO anon;

CREATE OR REPLACE FUNCTION public.get_shared_chart_data(p_share_id UUID, p_password TEXT DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shared_chart record;
    v_chart record;
    v_nodes jsonb;
    v_employees jsonb;
BEGIN
    SELECT * INTO v_shared_chart FROM public.shared_charts WHERE id = p_share_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Share link not found';
    END IF;
    
    IF v_shared_chart.expires_at < NOW() THEN
        RAISE EXCEPTION 'Share link expired';
    END IF;
    
    IF v_shared_chart.password IS NOT NULL AND v_shared_chart.password != '' AND v_shared_chart.password != p_password THEN
        RAISE EXCEPTION 'Incorrect password';
    END IF;
    
    -- Fetch chart
    SELECT * INTO v_chart FROM public.org_charts WHERE id = v_shared_chart.chart_id;
    
    -- Fetch nodes
    SELECT jsonb_agg(row_to_json(n)) INTO v_nodes FROM public.org_nodes n WHERE chart_id = v_shared_chart.chart_id;
    
    -- Fetch employees used in this chart
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', e.id,
            'name', e.first_name || ' ' || e.last_name,
            'first_name', e.first_name,
            'last_name', e.last_name,
            'job_title', e.job_title,
            'department', e.department,
            'location', (SELECT name FROM locations WHERE id = e.location_id LIMIT 1)
        )
    ) INTO v_employees
    FROM public.employees e
    WHERE e.id IN (SELECT employee_id FROM public.org_nodes WHERE chart_id = v_shared_chart.chart_id AND employee_id IS NOT NULL);
    
    RETURN jsonb_build_object(
        'chart', row_to_json(v_chart),
        'nodes', COALESCE(v_nodes, '[]'::jsonb),
        'employees', COALESCE(v_employees, '[]'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_chart_data(UUID, TEXT) TO anon, authenticated;
