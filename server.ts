import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Supabase Admin Client (using Service Role Key)
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabaseAdmin: any;
if (supabaseUrl && supabaseServiceKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (e) {
    console.error("Failed to initialize Supabase Admin Client:", e);
  }
}

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseServiceKey });
});

// API Endpoint to list all users
app.get("/api/admin/list-users", async (req, res) => {
  console.log("Request received: /api/admin/list-users");
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Configuration missing for list-users:", { url: !!url, key: !!key });
    return res.status(500).json({ error: "Configuration missing" });
  }

  try {
    const adminClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { users }, error: authError } = await adminClient.auth.admin.listUsers();
    if (authError) {
      console.error("Auth Error in list-users:", authError);
      throw authError;
    }

    const { data: roles, error: rolesError } = await adminClient.from("user_roles").select("*");
    if (rolesError) {
      console.error("Roles Error in list-users:", rolesError);
      throw rolesError;
    }

    const usersWithRoles = users.map(user => ({
      id: user.id,
      email: user.email,
      role: roles.find(r => r.user_id === user.id)?.role || 'employee'
    }));

    console.log(`Successfully fetched ${usersWithRoles.length} users`);
    res.json(usersWithRoles);
  } catch (error: any) {
    console.error("Catch Error in list-users:", error);
    res.status(400).json({ error: error.message });
  }
});

// API Endpoint to create a user account
app.post("/api/admin/create-user", async (req, res) => {
  const { email, password, role } = req.body;

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return res.status(500).json({ 
      error: "إعدادات السيرفر مفقودة. تأكد من إضافة SUPABASE_SERVICE_ROLE_KEY و VITE_SUPABASE_URL في قائمة Secrets." 
    });
  }

  // التحقق مما إذا كان المستخدم قد وضع مفتاح anon بدلاً من service_role
  if (key === anonKey) {
    return res.status(400).json({
      error: "خطأ في الإعدادات: لقد قمت باستخدام مفتاح (anon) العام. لإنشاء حسابات، يجب استخدام مفتاح (service_role) السري من إعدادات Supabase."
    });
  }

  try {
    console.log(`Attempting to create user: ${email}`);
    console.log(`Key length: ${key.length}, Starts with: ${key.substring(0, 10)}...`);

    // Initialize Admin Client inside request to ensure it has latest env vars
    const adminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Check if user already exists in Auth
    let userId: string | undefined;
    let isNewUser = false;

    // We can try to create the user, and if it fails because they exist, we just get their ID
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        // User exists, let's find them to update their role
        console.log("User already exists, finding UID...");
        const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
        if (listError) throw listError;
        
        const existingUser = users.find((u: any) => u.email === email);
        if (existingUser) {
          userId = existingUser.id;
        } else {
          throw new Error("Could not find existing user despite registration error");
        }
      } else {
        console.error("Supabase Auth Error:", authError);
        throw authError;
      }
    } else {
      userId = authData.user?.id;
      isNewUser = true;
    }

    // 2. Assign the role in user_roles table
    if (userId && isNewUser) {
      const { error: roleError } = await adminClient
        .from("user_roles")
        .upsert({ 
          user_id: userId, 
          role: role || 'employee' 
        }, { onConflict: 'user_id' });

      if (roleError) {
        console.error("Supabase DB Error:", roleError);
        throw roleError;
      }
    }

    res.json({ 
      success: true, 
      message: isNewUser ? "User account created successfully" : "User already exists", 
      userId 
    });
  } catch (error: any) {
    console.error("Error creating user:", error);
    res.status(400).json({ error: error.message });
  }
});

// API Endpoint to send password reset email
app.post("/api/admin/reset-password", async (req, res) => {
  const { email } = req.body;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: "Configuration missing" });
  }

  try {
    const adminClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });

    if (error) throw error;

    res.json({ success: true, message: "Password reset email link generated (email sending requires SMTP configuration in Supabase)" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// API Endpoint to update user password
app.post("/api/admin/update-password", async (req, res) => {
  const { email, newPassword } = req.body;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: "Configuration missing" });
  }

  try {
    const adminClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Find user by email
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;
    
    const user = users.find((u: any) => u.email === email);
    if (!user) throw new Error("المستخدم غير موجود");

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) throw updateError;

    res.json({ success: true, message: "تم تحديث كلمة المرور بنجاح" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// API Endpoint to delete user account
app.post("/api/admin/delete-user", async (req, res) => {
  const { email } = req.body;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: "Configuration missing" });
  }

  try {
    const adminClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Find user by email
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;
    
    const user = users.find((u: any) => u.email === email);
    if (user) {
      // 2. Delete from Auth
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
      if (deleteError) throw deleteError;

      // 3. Delete role from user_roles
      await adminClient.from("user_roles").delete().eq("user_id", user.id);
    }

    res.json({ success: true, message: "تم حذف حساب المستخدم بنجاح" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
