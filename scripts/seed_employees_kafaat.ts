
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const employeesData = [
  { name: "حاكم غافل مسلم", job_title: "مسؤول قطاع", department: "إدارة القطاع", hire_date: "2025-09-03", salary: 700000 },
  { name: "علي عادل عبود", job_title: "معاون مدير القطاع", department: "إدارة القطاع", hire_date: "2026-01-12", salary: 650000 },
  { name: "علي عادل كاظم", job_title: "مسؤول الشكاوي", department: "شعبة الشكاوي", hire_date: "2025-12-20", salary: 625000 },
  { name: "حسين مقداد", job_title: "مسؤول الشكاوي", department: "شعبة الشكاوي", hire_date: "2025-12-20", salary: 625000 },
  { name: "محمد علي كاظم", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-10-12", salary: 625000 },
  { name: "مصطفى علاوي حسين", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-10-11", salary: 625000 },
  { name: "مرتضى عبد الكاظم عسكر", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-09-27", salary: 625000 },
  { name: "امير قحطان غريب", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-09-27", salary: 625000 },
  { name: "سعود فيصل عسكر", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-09-27", salary: 625000 },
  { name: "حيدر عادل هاشم", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-11-23", salary: 625000 },
  { name: "مهند رشيد عبد العزيز", job_title: "سائق اليه ثقيلة", department: "شعبة الاليات", hire_date: "2026-01-05", salary: 625000 },
  { name: "محمد فرحان كاظم", job_title: "سائق اليه ثقيلة", department: "شعبة الاليات", hire_date: "2025-12-23", salary: 625000 },
  { name: "مرتضى خيون نعمة", job_title: "حارس واستعلامات", department: "شعبة الادارة", hire_date: "2025-10-11", salary: 500000 },
  { name: "مرتضى محسن كمر", job_title: "حارس واستعلامات", department: "شعبة الادارة", hire_date: "2025-10-11", salary: 500000 },
  { name: "يحيى صباح خضر", job_title: "سائق بيكم", department: "شعبة الاليات", hire_date: "2025-12-22", salary: 600000 },
  { name: "فاطمة جاسم محمد", job_title: "اداري ومخزن بسيط", department: "شعبة الادارة", hire_date: "2025-10-09", salary: 600000 },
  { name: "حسنين علي راضي", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-14", salary: 250000 },
  { name: "محمد علي رزاق", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-11", salary: 250000 },
  { name: "سجاد فاضل سويف", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-12", salary: 250000 },
  { name: "حسين جمال برهان", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-05", salary: 250000 },
  { name: "حيدر احمد هليل", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-12", salary: 250000 },
  { name: "علاء عامر جمعة", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-05", salary: 250000 },
  { name: "سار هادي ليلو", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2026-01-01", salary: 0 },
  { name: "مصطفى سعدي حسن", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2026-01-01", salary: 0 },
  { name: "مصطفى جابر شمال", job_title: "فني معار", department: "شعبة الصيانة", hire_date: "2025-11-01", salary: 0 },
  { name: "علي كاظم حسين", job_title: "فني معار", department: "شعبة الصيانة", hire_date: "2025-11-02", salary: 0 },
  { name: "اخلاص نجم عبد", job_title: "مسؤول شعبة مبيعات", department: "شعبة المبيعات", hire_date: "2024-12-01", salary: 650000 },
  { name: "حسين باسم محمد", job_title: "امين صندوق", department: "شعبة الحسابات", hire_date: "2025-12-20", salary: 600000 },
  { name: "فاطمة داخل حسن", job_title: "مدقق ومرحل قراءات", department: "شعبة المبيعات", hire_date: "2025-10-05", salary: 600000 },
  { name: "فاطمة عدنان فليح", job_title: "ملاحظ سجل مبيعات", department: "شعبة المبيعات", hire_date: "2025-10-01", salary: 600000 },
  { name: "مها علي حسين شاكر", job_title: "ملاحظ سجل مبيعات", department: "شعبة المبيعات", hire_date: "2025-10-05", salary: 600000 }
];

async function seed() {
  console.log('Starting seeding for قطاع الكفاءات...');

  // 1. Get or Create Location
  let { data: location, error: locError } = await supabase
    .from('locations')
    .select('id')
    .eq('name', 'قطاع الكفاءات')
    .single();

  if (locError && locError.code === 'PGRST116') {
     console.log('Location "قطاع الكفاءات" not found, creating it...');
     const { data: newLoc, error: createLocError } = await supabase
      .from('locations')
      .insert([{ name: 'قطاع الكفاءات' }])
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
  console.log(`Using Location ID for قطاع الكفاءات: ${locationId}`);

  // 2. Insert Employees
  const employeesToInsert = employeesData.map((emp, index) => ({
    first_name: emp.name,
    last_name: '',
    email: `kafaat_${index + 1}_${Date.now()}@example.com`,
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
    console.log('Successfully inserted 31 employees for قطاع الكفاءات!');
  }
}

seed();
