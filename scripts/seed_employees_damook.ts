
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const employeesData = [
  { name: "طه حمزة خضر", job_title: "مسؤول قطاع", department: "إدارة القطاع", hire_date: "2025-09-08", salary: 700000 },
  { name: "جعفر عبدالحسين شاكر", job_title: "معاون مسؤول قطاع", department: "إدارة القطاع", hire_date: "2025-08-31", salary: 650000 },
  { name: "احمد سرحان حسن", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-12-24", salary: 625000 },
  { name: "مهدي حمزة خضر", job_title: "مسؤول الشكاوي", department: "شعبة الشكاوي", hire_date: "2025-09-21", salary: 625000 },
  { name: "محسن فاضل كريم", job_title: "مسؤول الشكاوي", department: "شعبة الشكاوي", hire_date: "2025-09-21", salary: 625000 },
  { name: "هشام جاسم حزام", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-01-01", salary: 625000 },
  { name: "حسين ثجيل مشول", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2026-01-07", salary: 625000 },
  { name: "محمد ثجيل مشول", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-09-22", salary: 625000 },
  { name: "رضا عبد الساده", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-12-10", salary: 625000 },
  { name: "علي لفته كعيم", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-09-22", salary: 625000 },
  { name: "محمد عبد الرضا حربي", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-08-31", salary: 625000 },
  { name: "حسين جعفر صالح", job_title: "سائق اليه ثقيلة", department: "شعبة الاليات", hire_date: "2025-09-21", salary: 625000 },
  { name: "زيدون علي حبيب", job_title: "سائق اليه ثقيلة", department: "شعبة الاليات", hire_date: "2025-09-21", salary: 625000 },
  { name: "عباس كريم داود", job_title: "حارس واستعلامات", department: "شعبة الادارة", hire_date: "2025-09-21", salary: 500000 },
  { name: "علي خماس خضر", job_title: "حارس واستعلامات", department: "شعبة الادارة", hire_date: "2025-09-21", salary: 500000 },
  { name: "عباس حمادي هادي", job_title: "سائق بيكم", department: "شعبة الاليات", hire_date: "2025-10-14", salary: 600000 },
  { name: "ياسر علاء تركي", job_title: "اداري ومخزن بسيط", department: "شعبة الادارة", hire_date: "2025-08-31", salary: 600000 },
  { name: "مرتضى عبد الحسين مسلم", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2026-01-01", salary: 250000 },
  { name: "محمد احمد هويش", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-12", salary: 250000 },
  { name: "ايمن رفاء جليل", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-09-08", salary: 250000 },
  { name: "محمد كامل عريبي", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2026-01-01", salary: 0 },
  { name: "علي عادل حياوي", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2026-01-01", salary: 0 },
  { name: "حمزة كاظم سلمان", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2026-01-01", salary: 0 },
  { name: "عباس شنون", job_title: "فني معار", department: "شعبة الصيانة", hire_date: "2025-12-01", salary: 0 },
  { name: "احمد حسن داغر", job_title: "فني معار", department: "شعبة الصيانة", hire_date: "2025-12-01", salary: 0 },
  { name: "رياض لفتة عبد", job_title: "فني معار", department: "شعبة الصيانة", hire_date: "2025-12-01", salary: 0 },
  { name: "احمد حسين علي", job_title: "مسؤول مبيعات", department: "شعبة المبيعات", hire_date: "2026-08-03", salary: 650000 },
  { name: "احمد يحيى عناد", job_title: "مدقق ومرحل قراءات", department: "شعبة المبيعات", hire_date: "2025-10-05", salary: 600000 },
  { name: "احمد حاتم كريم", job_title: "مدقق ومرحل قراءات", department: "شعبة المبيعات", hire_date: "2026-03-12", salary: 600000 },
  { name: "ذو الفقار جبار حميد", job_title: "امين صندوق", department: "شعبة الحسابات", hire_date: "2025-10-10", salary: 600000 },
  { name: "محمد المصطفى سمير", job_title: "ملاحظ سجل مبيعات", department: "شعبة المبيعات", hire_date: "2025-10-27", salary: 600000 }
];

async function seed() {
  console.log('Starting seeding for قطاع داموك...');

  // 1. Get or Create Location
  let { data: location, error: locError } = await supabase
    .from('locations')
    .select('id')
    .eq('name', 'قطاع داموك')
    .single();

  if (locError && locError.code === 'PGRST116') {
     console.log('Location "قطاع داموك" not found, creating it...');
     const { data: newLoc, error: createLocError } = await supabase
      .from('locations')
      .insert([{ name: 'قطاع داموك' }])
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
  console.log(`Using Location ID for قطاع داموك: ${locationId}`);

  // 2. Insert Employees
  const employeesToInsert = employeesData.map((emp, index) => ({
    first_name: emp.name,
    last_name: '',
    email: `damook_${index + 1}_${Date.now()}@example.com`,
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
    console.log('Successfully inserted 31 employees for قطاع داموك!');
  }
}

seed();
