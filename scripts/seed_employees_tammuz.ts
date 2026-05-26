
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const employeesData = [
  { name: "الحسن كريم حسين", job_title: "معاون مدير القطاع", department: "إدارة القطاع", hire_date: "2025-09-15", salary: 650000 },
  { name: "مروان عبد الجبار", job_title: "مسؤول القطاع", department: "إدارة القطاع", hire_date: "2025-09-27", salary: 700000 },
  { name: "سجاد فالح كاظم", job_title: "مسؤول الشكاوي", department: "شعبة الشكاوي", hire_date: "2025-12-24", salary: 625000 },
  { name: "علي هادي كاظم رشيد", job_title: "مسؤول الشكاوي", department: "شعبة الشكاوي", hire_date: "2025-03-04", salary: 625000 },
  { name: "كرار عطا كاظم", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-09-15", salary: 625000 },
  { name: "احمد عطا كريم", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-12-18", salary: 625000 },
  { name: "سلام مهدي جاسم", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-10-06", salary: 625000 },
  { name: "حسن عبد الجبار", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-09-25", salary: 625000 },
  { name: "كرار موسى عمبر", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-10-12", salary: 625000 },
  { name: "خالد مهدي جادر", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-12-22", salary: 625000 },
  { name: "مهدي صالح حسن", job_title: "سائق اليه ثقيلة", department: "شعبة الاليات", hire_date: "2025-12-25", salary: 625000 },
  { name: "يوسف عباس رحيم", job_title: "سائق اليه ثقيلة", department: "شعبة الاليات", hire_date: "2025-12-22", salary: 625000 },
  { name: "حيدر محمد علي", job_title: "حارس واستعلامات", department: "شعبة الادارة", hire_date: "2025-09-15", salary: 500000 },
  { name: "حسن رائد حسن", job_title: "حارس واستعلامات", department: "شعبة الادارة", hire_date: "2025-10-02", salary: 500000 },
  { name: "حمادة خالد كاظم", job_title: "اداري ومخزن بسيط", department: "شعبة الادارة", hire_date: "2025-10-06", salary: 600000 },
  { name: "محمد حميد خلف", job_title: "مسؤول مبيعات", department: "المبيعات", hire_date: "2025-09-08", salary: 650000 },
  { name: "ذو الفقار احمد مايع", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-12", salary: 250000 },
  { name: "عباس ياسين حبيب", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-12", salary: 250000 },
  { name: "ماهر نجم كاظم", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-05", salary: 250000 },
  { name: "علي نصير كريم", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2026-09-08", salary: 250000 },
  { name: "مقداد موسى محمد", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: "2025-10-12", salary: 250000 },
  { name: "نوفل قصي عكال", job_title: "قراء مقاييس", department: "قارئ مقياس", hire_date: null, salary: 0 },
  { name: "سلام رحم غضبان", job_title: "فني معار", department: "شعبة الصيانة", hire_date: null, salary: 0 },
  { name: "مهيب هادي شراد", job_title: "فني معار", department: "شعبة الصيانة", hire_date: null, salary: 0 },
  { name: "حسين علي كاظم", job_title: "فني معار", department: "شعبة الصيانة", hire_date: null, salary: 0 },
  { name: "حسين سعدون كاظم", job_title: "فني معار", department: "شعبة الصيانة", hire_date: null, salary: 0 },
  { name: "شيرين رياض نعيم", job_title: "مدقق ومرحل قراءات", department: "شعبة المبيعات", hire_date: "2025-09-08", salary: 600000 },
  { name: "امير عبد المنعم", job_title: "امين صندوق", department: "شعبة الحسابات", hire_date: "2025-09-23", salary: 600000 },
  { name: "بروج راضي سعيد", job_title: "ملاحظ سجل مبيعات", department: "شعبة المبيعات", hire_date: "2025-09-25", salary: 600000 },
  { name: "نرجس خالد حسين", job_title: "ملاحظ سجل مبيعات", department: "شعبة المبيعات", hire_date: "2025-10-12", salary: 600000 }
];

async function seed() {
  console.log('Starting seeding for قطاع تموز...');

  // 1. Get or Create Location
  let { data: location, error: locError } = await supabase
    .from('locations')
    .select('id')
    .eq('name', 'قطاع تموز')
    .single();

  if (locError && locError.code === 'PGRST116') {
     console.log('Location "قطاع تموز" not found, creating it...');
     const { data: newLoc, error: createLocError } = await supabase
      .from('locations')
      .insert([{ name: 'قطاع تموز' }])
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
  console.log(`Using Location ID for قطاع تموز: ${locationId}`);

  // 2. Insert Employees
  const employeesToInsert = employeesData.map((emp, index) => ({
    first_name: emp.name,
    last_name: '',
    email: `tammuz_${index + 1}_${Date.now()}@example.com`,
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
    console.log('Successfully inserted 30 employees for قطاع تموز!');
  }
}

seed();
