import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://npsqlaumhzzlqjtycpim.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wc3FsYXVtaHp6bHFqdHljcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MDAzMzAsImV4cCI6MjA2ODI3NjMzMH0.i_dRSQj_l5bpzHjKMeq58QjWwoa8Y2QikeZrav8-rxo'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  console.log('Running integration test...')
  const { data: { session } } = await supabase.auth.signInWithPassword({ email: 'test@example.com', password: 'testpassword' })
  if (!session) throw new Error('Auth failed')
  const file = new File(['hello'], 'test.pdf', { type: 'application/pdf' })
  const uploadRes = await supabase.storage.from('documents').upload(`test/${Date.now()}.pdf`, file)
  console.log('Upload:', uploadRes.error || 'ok')
  await supabase.functions.invoke('extract-pdf-text', { body: { documentId: uploadRes.data.path.split('/').pop() } })
  const chatRes = await supabase.functions.invoke('chat-stream', { body: { message: 'Ping' }, headers: { Authorization: `Bearer ${session.access_token}` } })
  console.log('Chat status:', chatRes.error || chatRes.data)
}
run().catch(err => { console.error(err); process.exit(1) })
