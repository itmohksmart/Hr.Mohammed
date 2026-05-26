
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const employeesData = [
  { name: "فاضل حسن احمد", job_title: "معاون مسؤول قطاع", department: "إدارة القطاع", hire_date: "2025-09-18", salary: 650000 },
  { name: "نجم عبدالله ياسين", job_title: "مدير القطاع", department: "إدارة القطاع", hire_date: "2026-04-14", salary: 700000 },
  { name: "علي حميد حسين", job_title: "مسؤول الشكاوي", department: "شعبة الشكاوي", hire_date: "2026-01-01", salary: 625000 },
  { name: "عبد الله محمد جبار", job_title: "فني شركة", department: "صيانة / شركة", hire_date: "2025-09-17", salary: 625000 },
  { name: "صلاح نعمان جاسم", job_title: "فني شركة", department: "صيانة / شركة", hire_date: "2025-12-13", salary: 625000 },
  { name: "علي ضياء نقي", job_title: "فني شركة", department: "صيانة / شركة", hire_date: "2025-09-22", salary: 625000 },
  { name: "ذو الفقار علي حسين", job_title: "فني شركة", department: "صيانة / شركة", hire_date: "2025-09-25", salary: 625000 },
  { name: "حسين ثجيل فرحان", job_title: "فني شركة", department: "صيانة / شركة", hire_date: "2025-09-25", salary: 625000 },
  { name: "مصطفى محمد علي", job_title: "فني شركة", department: "صيانة / شركة", hire_date: "2025-12-25", salary: 625000 },
  { name: "ليث عواد جهاد", job_title: "سائق اليه ثقيلة", department: "شعبة الاليات", hire_date: "2025-09-22", salary: 625000 },
  { name: "محمد باقر قاسم", job_title: "سائق اليه ثقيلة", department: "شعبة الاليات", hire_date: "2025-12-22", salary: 625000 },
  { name: "احسان سلمان جاسم", job_title: "حارس واستعلامات", department: "شعبة الإدارة", hire_date: "2025-09-17", salary: 625000 },
  { name: "محمد سهيل عباس", job_title: "حارس واستعلامات", department: "شعبة الإدارة", hire_date: "2025-09-23", salary: 625000 },
  { name: "جمال خضير ياسر", job_title: "سائق بيكم", department: "شعبة الاليات", hire_date: "2025-09-23", salary: 625000 },
  { name: "ياسر صادق ياسر", job_title: "اداري ومخزن وسيط", department: "شعبة الإدارة", hire_date: "2024-12-01", salary: 600000 },
  { name: "حسين حارث حسون", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-09-08", salary: 250000 },
  { name: "محمد حسين ياسين", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-12-18", salary: 250000 },
  { name: "وسام محمد عباس", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-12", salary: 250000 },
  { name: "علي نجم عبد علي", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-12", salary: 250000 },
  { name: "صدر الدين علي حسين", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-12-13", salary: 250000 },
  { name: "محمد حسين علي", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-12-07", salary: 0 },
  { name: "احمد طه راضي", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-12-07", salary: 0 },
  { name: "صلاح صاحب دبي", job_title: "فني معار", department: "صيانة / معار", hire_date: "2025-12-07", salary: 0 },
  { name: "مالك فاضل محمد", job_title: "فني معار", department: "صيانة / معار", hire_date: "2025-12-07", salary: 0 },
  { name: "محمد علي يعقوب", job_title: "امين صندوق", department: "شعبة الحسابات", hire_date: "2025-09-23", salary: 600000 },
  { name: "احمد عبد محمد", job_title: "مسؤول شعبة مبيعات", department: "شعبة المبيعات", hire_date: "2024-12-01", salary: 600000 },
  { name: "رقية حسام جليل", job_title: "مدقق ومرحل قراءات", department: "شعبة المبيعات", hire_date: "2025-08-31", salary: 600000 },
  { name: "شهد محمد عباس", job_title: "ملاحظ سجل مبيعات", department: "شعبة المبيعات", hire_date: "2025-10-12", salary: 600000 },
  { name: "مريم عبدالرضا كريم", job_title: "ملاحظ سجل مبيعات", department: "شعبة المبيعات", hire_date: "2025-08-31", salary: 600000 },
  { name: "حيدر علي خضير", job_title: "مسؤول الشكاوي", department: "شعبة الشكاوي", hire_date: "2025-12-13", salary: 600000 }
];

async function seed() {
  console.log('Starting seeding for قطاع الخاجية...');

  // 1. Get or Create Location
  let { data: location, error: locError } = await supabase
    .from('locations')
    .select('id')
    .eq('name', 'قطاع الخاجية')
    .single();

  if (locError && locError.code === 'PGRST116') {
     console.log('Location "قطاع الخاجية" not found, creating it...');
     const { data: newLoc, error: createLocError } = await supabase
      .from('locations')
      .insert([{ name: 'قطاع الخاجية' }])
      .select()
      .single();
     
     if (createLocError) {
       console.error('Error creating location:', createLocError);
       return;
     }
     location = newLoc;
  } else if (locError) {
    console.error('Error fetching location:', locError);
    return;
  }

  const locationId = location.id;
  console.log(`Using Location ID for قطاع الخاجية: ${locationId}`);

  // 2. Insert Employees
  const employeesToInsert = employeesData.map((emp, index) => ({
    first_name: emp.name,
    last_name: '',
    email: `khajia_${index + 1}_${Date.now()}@example.com`,
    job_title: emp.job_title,
    department: emp.department,
    location_id: locationId,
    hire_date: emp.hire_date || new Date().toISOString().split('T')[0],
    salary: emp.salary,
    status: 'active'
  }));

  const { error: insertError } = await supabase
    .from('employees')
    .insert(employeesToInsert);

  if (insertError) {
    console.error('Error inserting employees:', insertError);
  } else {
    console.log('Successfully inserted 30 employees for قطاع الخاجية!');
  }
}

seed();
