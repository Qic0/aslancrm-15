import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dynamically import web-push to avoid type checking issues
const webpushModule = await import('web-push');
const webpush = webpushModule.default || webpushModule;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, title, body, taskId, orderId, url } = await req.json();

    console.log('Sending push notification:', { userId, title, body, taskId, orderId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log('VAPID keys not configured, skipping push notification');
      return new Response(
        JSON.stringify({ message: 'VAPID keys not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Сохраняем уведомление в историю
    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        body,
        task_id: taskId || null,
        order_id: orderId || null,
        url: url || '/worker',
      });

    if (insertError) {
      console.error('Error saving notification to history:', insertError);
      // Продолжаем, даже если не удалось сохранить историю
    } else {
      console.log('Notification saved to history');
    }

    // Получаем все подписки пользователя
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      throw fetchError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No subscriptions found for user:', userId);
      return new Response(
        JSON.stringify({ message: 'No subscriptions found, but saved to history' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} subscription(s) for user`);

    // Настраиваем VAPID детали для web-push
    (webpush as any).setVapidDetails(
      'mailto:admin@aslan-crm.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    const payload = JSON.stringify({
      title,
      body,
      taskId,
      orderId,
      url: url || '/worker'
    });

    // Отправляем уведомление на каждое устройство
    const results = [];
    
    for (const sub of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await (webpush as any).sendNotification(pushSubscription, payload);
        
        console.log('Notification sent successfully to:', sub.endpoint);
        results.push({ success: true, endpoint: sub.endpoint });
      } catch (error) {
        console.error('Error sending to subscription:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ success: false, endpoint: sub.endpoint, error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Sent ${successCount}/${results.length} notifications successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount,
        total: results.length,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-push-notification function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});