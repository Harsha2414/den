-- Den: remove the demo students added by add-demo-posts.sql, with all their posts, comments,
-- likes and events. Real students are not touched. Run in the Supabase SQL Editor.

delete from auth.users where email like '%@den-demo.ac.in';
