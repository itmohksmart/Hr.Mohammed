
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const employeesData = [
  { name: "انفال رياض حمود", job_title: "اداري ومخزن وسيط", department: "شعبة الإدارة", hire_date: "2025-09-28", salary: 600000 },
  { name: "حيدر علي جليل", job_title: "امين صندوق", department: "شعبة الحسابات", hire_date: "2025-10-10", salary: 600000 },
  { name: "حسين ترف منصور", job_title: "حارس واستعلامات", department: "شعبة الإدارة", hire_date: "2025-09-21", salary: 500000 },
  { name: "ياسر محسن جبر", job_title: "حارس واستعلامات", department: "شعبة الإدارة", hire_date: "2025-09-23", salary: 500000 },
  { name: "محمد حمزة خورشيد", job_title: "سائق اليه ثقيلة", department: "شعبة الاليات", hire_date: "2025-09-25", salary: 625000 },
  { name: "فلاح حسن جبار", job_title: "سائق اليه ثقيلة", department: "شعبة الاليات", hire_date: "2026-01-06", salary: 625000 },
  { name: "حسين فليح صبيح", job_title: "سائق بيكم", department: "شعبة الاليات", hire_date: "2026-12-08", salary: 600000 },
  { name: "علي ثجيل فرحان", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-12-20", salary: 625000 },
  { name: "احمد حسن جواد", job_title: "فني شركة", department: "صيانة / شركة", hire_date: "2025-12-25", salary: 625000 },
  { name: "حسام عباس حميد", job_title: "فني شركة", department: "صيانة / شركة", hire_date: "2025-09-25", salary: 600000 },
  { name: "حمزة جبير عبد", job_title: "فني شركة", department: "صيانة / شركة", hire_date: "2025-12-25", salary: 625000 },
  { name: "ضياء حسين حسون", job_title: "فني شركة", department: "صيانة / شركة", hire_date: "2025-09-18", salary: 625000 },
  { name: "علي عماد يوسف", job_title: "فني شركة", department: "صيانة / شركة", hire_date: "2026-01-03", salary: 625000 },
  { name: "امجد حميد محمد", job_title: "فني معار", department: "صيانة / معار", hire_date: null, salary: 0 },
  { name: "حسين عطيه جبار", job_title: "فني معار", department: "صيانة / معار", hire_date: null, salary: 0 },
  { name: "مكي ابراهيم مكي", job_title: "فني معار", department: "صيانة / معار", hire_date: null, salary: 0 },
  { name: "ياسر علوان عنبور", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-09-08", salary: 250000 },
  { name: "سجاد قاسم حسن", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-12", salary: 250000 },
  { name: "عبد محمد عبيد", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-12", salary: 250000 },
  { name: "عقيل طالب كاظم", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-12-25", salary: 250000 },
  { name: "زيد طارق إبراهيم", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2026-01-01", salary: 250000 },
  { name: "مصطفى غركان علي", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2026-01-02", salary: 0 },
  { name: "حسنين راشد", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2026-01-03", salary: 0 },
  { name: "قاسم صيوان", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2026-01-04", salary: 0 },
  { name: "جعفر صادق", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2026-01-05", salary: 0 },
  { name: "زينب سلمان نعيم", job_title: "مدقق ومرحل قراءات", department: "شعبة الحسابات", hire_date: "2025-10-01", salary: 600000 },
  { name: "نعمة حميد عبدالخضر", job_title: "مدير القطاع", department: "إدارة القطاع", hire_date: "2026-01-24", salary: 700000 },
  { name: "علي نجم عبدالله", job_title: "مسؤول الشكاوي", department: "شعبة الشكاوي", hire_date: "2025-10-18", salary: 625000 },
  { name: "اسعد عبد الجليل", job_title: "مسؤول الشكاوي", department: "شعبة الشكاوي", hire_date: "2025-12-22", salary: 625000 },
  { name: "علي محمد خليف", job_title: "مسؤول مبيعات", department: "شعبة المبيعات", hire_date: "2025-10-12", salary: 700000 },
  { name: "هبة خلف هيلي", job_title: "ملاحظ سجل مبيعات", department: "شعبة المبيعات", hire_date: "2025-10-01", salary: 600000 },
  { name: "مريم مصطفى عطا", job_title: "ملاحظ سجل مبيعات", department: "شعبة المبيعات", hire_date: "2025-10-19", salary: 600000 },
  { name: "موسى طالب حاكم", job_title: "قراء مقاييس", department: "شعبة المبيعات", hire_date: "2025-09-08", salary: 250000 }
];

async function seed() {
  console.log('Starting seeding for قطاع الزهراء...');

  // 1. Get or Create Location
  let { data: location, error: locError } = await supabase
    .from('locations')
    .select('id')
    .eq('name', 'قطاع الزهراء')
    .single();

  if (locError && locError.code === 'PGRST116') {
     console.log('Location "قطاع الزهراء" not found, creating it...');
     const { data: newLoc, error: createLocError } = await supabase
      .from('locations')
      .insert([{ name: 'قطاع الزهراء' }])
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
  console.log(`Using Location ID for قطاع الزهراء: ${locationId}`);

  // 2. Insert Employees
  const employeesToInsert = employeesData.map((emp, index) => ({
    first_name: emp.name,
    last_name: '',
    email: `zahraa_${index + 1}_${Date.now()}@example.com`,
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
    console.log('Successfully inserted 33 employees for قطاع الزهراء!');
  }
}

seed();
