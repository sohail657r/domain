import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      throw new Error('Only admins can view sub-admins');
    }

    // Get all sub-admins
    const { data: subAdmins, error: subAdminsError } = await supabaseClient
      .from('user_roles')
      .select('id, user_id, role, created_at')
      .eq('role', 'subadmin')
      .order('created_at', { ascending: false });

    if (subAdminsError) throw subAdminsError;

    // Fetch email for each sub-admin
    const subAdminsWithEmail = await Promise.all(
      (subAdmins || []).map(async (admin) => {
        const { data: { user: subAdminUser }, error } = await supabaseClient.auth.admin.getUserById(
          admin.user_id
        );
        
        return {
          ...admin,
          email: subAdminUser?.email || 'Unknown'
        };
      })
    );

    return new Response(
      JSON.stringify({ subAdmins: subAdminsWithEmail }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});