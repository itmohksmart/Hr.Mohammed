
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const employeesData = [
  { name: "غسان زهير توفيق", job_title: "مسؤول قطاع", department: "إدارة القطاع", hire_date: "2025-09-27" },
  { name: "مرتضى سلام حسين", job_title: "معاون مسؤول قطاع", department: "إدارة القطاع", hire_date: "2025-12-23" },
  { name: "مصطفى ناجي", job_title: "مسؤول الشكاوي", department: "شعبة الشكاوي", hire_date: "2026-02-10" },
  { name: "علي علوان زبون", job_title: "مسؤول الشكاوي", department: "شعبة الشكاوي", hire_date: "2025-10-19" },
  { name: "حسين راضي بريسم", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-09-20" },
  { name: "علي خالد علي", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-09-20" },
  { name: "مصطفى حامد مانع", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-08-09" },
  { name: "سلام رياس جوحي", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-12-23" },
  { name: "أنور حميد عسكر", job_title: "فني شركة", department: "شعبة الصيانة", hire_date: "2025-09-30" },
  { name: "احمد كريم علي", job_title: "سائق اليه ثقيلة", department: "شعبة الاليات", hire_date: "2025-09-22" },
  { name: "زين العابدين فريد", job_title: "سائق اليه ثقيلة", department: "شعبة الاليات", hire_date: "2025-12-15" },
  { name: "محمد جاسم فرج", job_title: "سائق بيكم", department: "شعبة الاليات", hire_date: "2025-10-09" },
  { name: "احمد علوان مهدي محمد", job_title: "حارس واستعلامات", department: "شعبة الادارة", hire_date: "2026-03-10" },
  { name: "ميثم حارث حسون", job_title: "سائق بيكم", department: "شعبة الاليات", hire_date: "2025-09-23" },
  { name: "نور حسن خفيف", job_title: "اداري ومخزن بسيط", department: "شعبة الادارة", hire_date: "2025-09-21" },
  { name: "عباس سلمان عبد الرزاق", job_title: "قراء مقاييس", department: "شعبة المبيعات", hire_date: "2025-09-08" },
  { name: "مصطفى ابراهيم هادي", job_title: "قراء مقاييس", department: "شعبة المبيعات", hire_date: "2025-10-12" },
  { name: "أسامة أحمد مايع", job_title: "قراء مقاييس", department: "شعبة المبيعات", hire_date: "2024-12-01" },
  { name: "احمد عبد الحسين فاضل", job_title: "قراء مقاييس", department: "شعبة المبيعات", hire_date: null },
  { name: "احمد عبد الرحيم", job_title: "قراء مقاييس", department: "شعبة المبيعات", hire_date: null },
  { name: "طاهر حيدر", job_title: "قراء مقاييس", department: "شعبة المبيعات", hire_date: null },
  { name: "احمد سمير", job_title: "مدير مبيعات", department: "شعبة المبيعات", hire_date: null },
  { name: "باقر حسنين كاظم", job_title: "امين صندوق", department: "شعبة الحسابات", hire_date: "2025-09-23" },
  { name: "إسراء حميد عبد الأمير", job_title: "ملاحظ سجل ومرحل نقد", department: "شعبة المبيعات", hire_date: "2025-09-24" },
  { name: "اباء ياسر حمزة", job_title: "مدقق ومرحل قراءات", department: "شعبة المبيعات", hire_date: "2025-10-10" },
  { name: "حسين محمد عباس", job_title: "مدقق ومرحل قراءات", department: "شعبة المبيعات", hire_date: "2025-10-12" }
];

async function seed() {
  console.log('Starting seeding...');

  // 1. Get or Create Location
  let { data: location, error: locError } = await supabase
    .from('locations')
    .select('id')
    .eq('name', 'قطاع الهورة')
    .single();

  if (locError && locError.code === 'PGRST116') {
     console.log('Location not found, creating it...');
     const { data: newLoc, error: createLocError } = await supabase
      .from('locations')
      .insert([{ name: 'قطاع الهورة' }])
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
  console.log(`Using Location ID: ${locationId}`);

  // 2. Insert Employees
  const employeesToInsert = employeesData.map((emp, index) => ({
    first_name: emp.name,
    last_name: '',
    email: `alhoura_${index + 1}_${Date.now()}@example.com`, // Avoid unique constraint
    job_title: emp.job_title,
    department: emp.department,
    location_id: locationId,
    hire_date: emp.hire_date || new Date().toISOString().split('T')[0],
    salary: 0,
    status: 'active'
  }));

  const { error: insertError } = await supabase
    .from('employees')
    .insert(employeesToInsert);

  if (insertError) {
    console.error('Error inserting employees:', insertError);
  } else {
    console.log('Successfully inserted 26 employees!');
  }
}

seed();
