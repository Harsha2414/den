-- Den: demo posts for testing the home page.
-- Adds 12 demo students to YOUR college (the college of the first admin account), with 40 posts,
-- comments, likes and 3 upcoming events, so you can scroll the feed and try likes and comments.
--
-- Run in the Supabase SQL Editor. Remove everything again with remove-demo-posts.sql.
-- Demo students have emails ending in @den-demo.ac.in. No emails are sent and nobody can sign in as them.
-- Running this twice adds a second set; run the remove script first if you want a fresh set.

do $$
declare
  v_college text;
  v_admin uuid;
  v_users uuid[] := '{}';
  v_posts uuid[] := '{}';
  v_uid uuid;
  v_pid uuid;
  i int; j int; n int;
  people text[][] := array[
    ['Ananya Rao', 'CSE', '3rd year'], ['Rahul Mehta', 'EEE', '4th year'], ['Priya Sharma', 'Mechanical', '2nd year'],
    ['Arjun Reddy', 'ECE', '3rd year'], ['Sneha Iyer', 'Civil', '1st year'], ['Karthik Nair', 'IT', '2nd year'],
    ['Fatima Shaikh', 'CSE', '4th year'], ['Vikram Singh', 'MBA', 'Postgrad'], ['Meera Joshi', 'Biotechnology', '3rd year'],
    ['Aditya Kulkarni', 'ECE', '1st year'], ['Lakshmi Prasad', 'B.Pharm', '2nd year'], ['Rohan Das', 'Mechanical', '4th year']];
  posts text[][] := array[
    ['General', 'college', 'Techfest volunteer sign-ups close tonight. Briefing is at 7 pm in the main auditorium, bring your college ID.'],
    ['Hostel life', 'college', 'Mess menu changed again. Anyone know if the Sunday biryani is staying?'],
    ['Announcement', 'india', 'Coding club weekly DSA session moves to Thursday 6 pm. Topic: graphs. Beginners welcome.'],
    ['General', 'college', 'Selling my Casio fx-991EX, barely used. ₹600, DM me.'],
    ['Doubt', 'college', 'Does anyone have last year''s OS end-sem paper? The library copy is missing pages 4 to 6.'],
    ['General', 'college', 'Library is open till 2 am during end-sems, confirmed by the librarian.'],
    ['Lost & found', 'college', 'Lost a black earphone case near the canteen around 1 pm. Please DM if you found it.'],
    ['Doubt', 'college', 'Anyone up for badminton at 6 am tomorrow? Need two more.'],
    ['Doubt', 'india', 'Which elective is easier to score in, Cryptography or Cloud Computing? Seniors please help.'],
    ['General', 'college', 'The new chai stall outside Gate 2 is unreal. ₹10 masala chai and they open at 6 am.'],
    ['Announcement', 'college', 'Reminder: the fee payment portal closes this Friday at 5 pm. Don''t leave it for the last day.'],
    ['Lost & found', 'college', 'Found a Casio calculator in LH-3, row 4. Left it with the security desk at the main block.'],
    ['Doubt', 'india', 'Can someone explain Dijkstra vs Bellman-Ford like I''m five? Exam is on Monday.'],
    ['Hostel life', 'college', 'Water cooler on the second floor is finally fixed. Took only three weeks.'],
    ['Announcement', 'college', 'Rangoli competition entries are open. Teams of 3, register at the cultural committee desk.'],
    ['Doubt', 'college', 'Is the 9 am Maths class happening tomorrow or is sir on leave?'],
    ['General', 'college', 'Selling my cycle, Hero Sprint, 2 years old. ₹2,500, can show it near the hostel.'],
    ['General', 'college', 'Who else is going home for Diwali on the 29th? Split a cab to the station?'],
    ['Announcement', 'india', 'Starting a placement prep group for the Amazon online assessment. Comment and I''ll add you.'],
    ['Hostel life', 'college', 'Mess food today was actually good. Paneer butter masala and gulab jamun!'],
    ['Doubt', 'college', 'Need a teammate for Smart India Hackathon, web dev preferred. We have an ML person and a designer.'],
    ['Announcement', 'college', 'Photography club walk this Sunday, 6:30 am, meet at the main gate. Phones are fine too.'],
    ['Hostel life', 'college', 'WiFi down in the boys hostel again. Complaint raised with IT, ticket number in the group.'],
    ['General', 'india', 'Got my first internship offer today after 14 rejections. Don''t give up, it does happen.'],
    ['Doubt', 'college', 'How do I apply for the bus pass? The office says online but I can''t find the link.'],
    ['Lost & found', 'college', 'Blue water bottle with stickers left in the reading room. It''s at the library counter.'],
    ['General', 'college', 'Sports day trials start next Monday. Football and kabaddi teams need players.'],
    ['Doubt', 'college', 'Any good YouTube playlist for Engineering Mechanics? The textbook is not helping.'],
    ['Hostel life', 'college', 'Power cut from 2 to 4 pm tomorrow for maintenance. Charge your laptops.'],
    ['Announcement', 'college', 'Blood donation camp on Wednesday in the seminar hall, 10 am to 4 pm. Free juice and biscuits.'],
    ['General', 'college', 'Canteen has started selling filter coffee. This changes everything.'],
    ['Doubt', 'india', 'GATE or placements? I''m in 3rd year and can''t decide. What did you all pick and why?'],
    ['General', 'college', 'Looking for a roommate for a flat near the college from next month. ₹6,000 each.'],
    ['Lost & found', 'college', 'Found an ID card near the parking lot. Name starts with S. It''s with the watchman.'],
    ['Announcement', 'college', 'Our college team made it to the national robotics finals! Congrats to the whole club.'],
    ['Doubt', 'college', 'Does the lab record need to be handwritten or can we print it?'],
    ['Hostel life', 'college', 'Movie night on the terrace this Saturday. Bring snacks, someone bring a projector.'],
    ['General', 'college', 'Rain + no umbrella + 8 am lab. Pray for me.'],
    ['Doubt', 'college', 'What''s the minimum attendance to sit for end-sems this year? 75 or 65?'],
    ['General', 'india', 'Hello from the first week of college! Any tips for a nervous 1st year?']];
  comments text[] := array[
    'Same question!', 'Thanks for sharing', 'I can help, DM me', 'Is this confirmed?', 'This is so true 😂',
    'Count me in', 'Check the notice board near the office', 'Ask in the class group too', 'Happened to me last year', 'Following',
    'Great news!', 'What time exactly?', 'I have it, will send tonight', 'Finally!', 'Good luck 🙌'];
begin
  select college_id, id into v_college, v_admin from public.profiles where is_admin order by created_at limit 1;
  if v_college is null then raise exception 'No admin account found. Make yourself admin first (README step 6).'; end if;

  -- 12 demo students
  for i in 1 .. array_length(people, 1) loop
    v_uid := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'student' || i || '.' || substr(v_uid::text, 1, 6) || '@den-demo.ac.in', '', now(),
      '{"provider":"email","providers":["email"]}', '{}', now() - interval '20 days', now(), '', '', '', '');
    insert into public.profiles (id, name, college_id, branch, year, bio, terms_accepted_at, created_at)
    values (v_uid, people[i][1], v_college, people[i][2], people[i][3], 'Demo account for testing Den.', now(), now() - interval '20 days');
    v_users := v_users || v_uid;
  end loop;

  -- 40 posts, newest first, spread over the last few days
  for i in 1 .. array_length(posts, 1) loop
    insert into public.posts (author_id, college_id, visibility, kind, body, created_at)
    values (v_users[1 + (i - 1) % array_length(v_users, 1)], v_college, posts[i][2], posts[i][1], posts[i][3],
      now() - make_interval(mins => (i - 1) * 97 + 7))
    returning id into v_pid;
    v_posts := v_posts || v_pid;

    -- comments: 0 to 5 on each post
    n := (i * 7) % 6;
    for j in 1 .. n loop
      insert into public.comments (post_id, author_id, body, created_at)
      values (v_pid, v_users[1 + (i + j) % array_length(v_users, 1)], comments[1 + (i * 3 + j) % array_length(comments, 1)],
        now() - make_interval(mins => (i - 1) * 97 + 7) + make_interval(mins => j * 11));
    end loop;

    -- likes: 0 to 11 demo students
    n := (i * 5) % 12;
    for j in 1 .. n loop
      insert into public.likes (user_id, item_type, item_id) values (v_users[j], 'post', v_pid) on conflict do nothing;
    end loop;
  end loop;

  -- 3 upcoming events
  insert into public.events (author_id, college_id, title, kind, event_date, start_time, venue, details) values
    (v_users[1], v_college, 'Techfest opening night', 'Fest', (now() at time zone 'Asia/Kolkata')::date + 2, '18:00', 'Main auditorium', 'Robotics showcase, music and food stalls.'),
    (v_users[4], v_college, 'Graph algorithms workshop', 'Workshop', (now() at time zone 'Asia/Kolkata')::date + 4, '16:00', 'Seminar hall', 'Bring a laptop. Beginners welcome.'),
    (v_users[12], v_college, 'Inter-hostel football final', 'Sports', (now() at time zone 'Asia/Kolkata')::date + 6, '17:30', 'College ground', '');

  raise notice 'Added % demo students, % posts and 3 events to %', array_length(v_users, 1), array_length(v_posts, 1), v_college;
end $$;
