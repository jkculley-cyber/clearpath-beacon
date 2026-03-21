/**
 * Seed lesson_library with 30+ real elementary counseling lessons.
 *
 * Usage:
 *   node supabase/seed_lessons.mjs <counselor_id>
 *   COUNSELOR_ID=<uuid> node supabase/seed_lessons.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cghhabcbgyoqwqjzunfo.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnaGhhYmNiZ3lvcXdxanp1bmZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzU4NDQsImV4cCI6MjA4ODE1MTg0NH0.y2qpi6U9tMfTvgZjqGD_csx5VImCbuNNG8Awq3VKskg';

const counselorId = process.argv[2] || process.env.COUNSELOR_ID;
if (!counselorId) {
  console.error('Usage: node supabase/seed_lessons.mjs <counselor_id>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const lessons = [
  // ── Academic Development ──
  {
    title: 'Study Skills Toolbox (K-2)',
    entry_type: 'text',
    text_content: `Objective: Students will identify 3 strategies that help them focus and learn.\n\nMaterials: Paper toolbox template, crayons, anchor chart.\n\n1. Opening Circle (5 min): Ask "What helps you do your best work?" Chart responses.\n2. Mini-Lesson (10 min): Introduce the Study Skills Toolbox — find a quiet spot, break work into small pieces, ask for help. Model each with a think-aloud.\n3. Activity (15 min): Students decorate their own toolbox template and draw or write 3 tools they will use this week.\n4. Closing (5 min): Partner share — tell your neighbor one tool you picked and why.\n\nAssessment: Toolbox exit ticket — can student name at least 2 strategies?`,
    grade_tags: ['K', '1', '2'],
    asca_domain: 'Academic',
    topic_tags: ['study skills', 'focus', 'learning strategies'],
  },
  {
    title: 'Goal Setting with SMART Steps (3-5)',
    entry_type: 'text',
    text_content: `Objective: Students will write one SMART academic goal and identify action steps.\n\nMaterials: SMART goal worksheet, pencils, example poster.\n\n1. Opening (5 min): Read aloud a short scenario about a student who wants to improve in math but has no plan. Ask: "What's missing?"\n2. Direct Instruction (10 min): Teach S-M-A-R-T (Specific, Measurable, Achievable, Relevant, Time-bound). Walk through one example together on the board.\n3. Guided Practice (15 min): Students write their own SMART goal for this grading period. Counselor circulates to help refine.\n4. Closing (5 min): Volunteers share goals. Collect worksheets for follow-up check-in.\n\nFollow-up: Revisit goals in 3 weeks — are students on track?`,
    grade_tags: ['3', '4', '5'],
    asca_domain: 'Academic',
    topic_tags: ['goal setting', 'SMART goals', 'academic planning'],
  },
  {
    title: 'Test-Taking Strategies',
    entry_type: 'text',
    text_content: `Objective: Students learn 4 strategies for approaching tests with confidence.\n\nMaterials: Practice test page, strategy cards.\n\n1. Opening (5 min): "How do you feel before a test?" Feelings check-in with thumbs up/middle/down.\n2. Teach Strategies (10 min): (a) Read all directions first, (b) Skip and come back, (c) Eliminate wrong answers, (d) Deep breath before starting. Demonstrate each with a sample question.\n3. Practice Round (15 min): Students work through a low-stakes practice page using the strategies. Debrief which strategies they used.\n4. Closing (5 min): Create a personal "Test Day Plan" card to keep in their desk.\n\nExtension: Partner with teachers to reinforce strategies before upcoming assessments.`,
    grade_tags: ['3', '4', '5'],
    asca_domain: 'Academic',
    topic_tags: ['test taking', 'test anxiety', 'academic skills'],
  },
  {
    title: 'Organization Station (K-2)',
    entry_type: 'text',
    text_content: `Objective: Students practice organizing their materials and workspace.\n\nMaterials: Messy desk photo, sorting bins, timer.\n\n1. Opening (5 min): Show a photo of a messy desk vs. a tidy desk. "Which student is ready to learn? Why?"\n2. Sorting Game (10 min): Give each table group a jumbled set of school supplies. Race to sort into categories (writing tools, papers, books) in 2 minutes.\n3. Desk Check (10 min): Students organize their own desks using the categories. Counselor models with a sample desk.\n4. Closing (5 min): "One thing I will keep tidy this week is ___." Thumb pledge.\n\nTeacher Tie-In: Ask classroom teacher to do a desk check follow-up on Friday.`,
    grade_tags: ['K', '1', '2'],
    asca_domain: 'Academic',
    topic_tags: ['organization', 'responsibility', 'executive function'],
  },
  {
    title: 'Growth Mindset: The Power of Yet',
    entry_type: 'text',
    text_content: `Objective: Students understand the difference between a fixed and growth mindset and practice reframing "I can't" to "I can't yet."\n\nMaterials: "The Dot" by Peter H. Reynolds (or similar book), fixed/growth mindset sorting cards.\n\n1. Read Aloud (8 min): Read "The Dot." Discuss how Vashti's thinking changed.\n2. Mini-Lesson (7 min): Introduce fixed vs. growth mindset with kid-friendly language. "Your brain is like a muscle — it gets stronger when you practice."\n3. Sorting Activity (10 min): Pairs sort statement cards into Fixed or Growth columns. Discuss tricky ones as a class.\n4. Reframe Challenge (5 min): Each student writes one "I can't..." statement, then adds "...yet!" and one step they can take.\n\nAssessment: Collect reframe cards. Look for understanding of effort + strategy = growth.`,
    grade_tags: ['K', '1', '2', '3', '4', '5'],
    asca_domain: 'Academic',
    topic_tags: ['growth mindset', 'resilience', 'positive self-talk'],
  },
  {
    title: 'Homework Helpers',
    entry_type: 'link',
    url: 'https://www.schoolcounselor.org/school-counselors/standards-competencies',
    grade_tags: ['2', '3', '4'],
    asca_domain: 'Academic',
    topic_tags: ['homework', 'responsibility', 'time management'],
  },
  {
    title: 'Career Dress-Up Day Exploration (K-1)',
    entry_type: 'text',
    text_content: `Objective: Students explore different careers and connect them to school subjects.\n\nMaterials: Career picture cards, "When I Grow Up" coloring sheet.\n\n1. Opening (5 min): "What does your family do for work?" Brief sharing circle.\n2. Career Parade (10 min): Show 10 career picture cards (doctor, teacher, firefighter, artist, engineer, farmer, chef, scientist, pilot, veterinarian). For each, ask: "What do they need to know? What school subject helps?"\n3. Coloring Activity (10 min): Students draw themselves in a career they find interesting and dictate or write one sentence about why.\n4. Closing (5 min): Gallery walk — students look at each other's drawings. "What new career did you learn about today?"\n\nDisplay: Post drawings in hallway for Career Week.`,
    grade_tags: ['K', '1'],
    asca_domain: 'Academic',
    topic_tags: ['career exploration', 'career awareness', 'future planning'],
  },

  // ── Social/Emotional ──
  {
    title: 'Feelings Check-In: The Mood Meter',
    entry_type: 'text',
    text_content: `Objective: Students identify and label their emotions using a mood meter (energy + pleasantness).\n\nMaterials: Large mood meter poster (4 quadrants: red=high energy/unpleasant, yellow=high energy/pleasant, green=low energy/pleasant, blue=low energy/unpleasant), sticky dots.\n\n1. Opening (5 min): "Right now, how does your body feel? Lots of energy or a little? Happy or not so happy?" Introduce the 4 color zones.\n2. Model (5 min): Counselor shares: "This morning I felt yellow because I was excited about seeing you all." Place dot.\n3. Student Practice (10 min): Each student places a dot on the mood meter and tells a partner why they chose that zone.\n4. Vocabulary Builder (5 min): Brainstorm 3 feeling words for each zone. Post on chart.\n5. Closing (5 min): "Knowing your feelings is the first step to managing them. We'll practice that next time."\n\nOngoing: Use mood meter as a daily check-in routine.`,
    grade_tags: ['K', '1', '2', '3'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['feelings identification', 'emotional awareness', 'self-awareness'],
  },
  {
    title: 'Kelso\'s Choices: Small Problem Problem-Solving',
    entry_type: 'text',
    text_content: `Objective: Students distinguish small problems from big problems and use Kelso's 9 choices to handle small problems independently.\n\nMaterials: Kelso's Choices wheel poster, scenario cards.\n\n1. Opening (5 min): "What's the difference between a small problem and a big problem?" Anchor chart together. Big = someone is hurt or in danger (get an adult). Small = annoying but safe (try Kelso's choices first).\n2. Teach the Wheel (8 min): Review all 9 choices: Go to another game, Talk it out, Share and take turns, Ignore it, Walk away, Tell them to stop, Apologize, Make a deal, Wait and cool off.\n3. Scenario Practice (12 min): Read scenario cards aloud. Students hold up fingers for which choice(s) they would try. Discuss why different choices work for different situations.\n4. Closing (5 min): "Name one Kelso choice you want to try this week."\n\nReinforcement: Post wheel in every classroom. Prompt students: "Did you try two Kelso choices before coming to an adult?"`,
    grade_tags: ['K', '1', '2'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['conflict resolution', 'problem solving', 'independence'],
  },
  {
    title: 'Friendship Skills: Being a Bucket Filler',
    entry_type: 'text',
    text_content: `Objective: Students learn that kind actions fill others' invisible buckets and unkind actions dip from them.\n\nMaterials: "Have You Filled a Bucket Today?" by Carol McCloud, small bucket, paper hearts.\n\n1. Read Aloud (8 min): Read the book. Pause to ask: "Was that bucket filling or bucket dipping?"\n2. Discussion (5 min): "How does it feel when someone fills your bucket? When someone dips?" Chart responses.\n3. Activity (12 min): Each student writes 3 bucket-filling actions on paper hearts and drops them in the class bucket. Read several aloud.\n4. Closing (5 min): Bucket Filler pledge — "This week I will fill someone's bucket by _____."\n\nFollow-Up: Start a Bucket Filler board in the classroom where students can post notes about kind acts they witnessed.`,
    grade_tags: ['K', '1', '2'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['friendship', 'kindness', 'empathy', 'bucket filling'],
  },
  {
    title: 'Calm-Down Corner Toolkit',
    entry_type: 'text',
    text_content: `Objective: Students learn and practice 4 calm-down strategies they can use independently.\n\nMaterials: Breathing ball (Hoberman sphere), glitter jar, stress ball, calm-down strategy cards.\n\n1. Opening (5 min): "Has your body ever felt really angry or really worried? What happened?" Normalize big feelings.\n2. Strategy Stations (15 min, rotate every 3-4 min):\n   - Station 1: Belly breathing with the Hoberman sphere (breathe in = expand, out = contract)\n   - Station 2: Glitter jar — shake it and watch glitter settle, just like our thoughts settle when we're calm\n   - Station 3: Squeeze and release — stress ball, tense muscles then relax\n   - Station 4: Positive self-talk cards — read and repeat ("I can handle this," "This feeling will pass")\n3. Closing (5 min): "Which strategy worked best for YOUR body?" Students choose their top 2 and draw them on a personal calm-down plan card.\n\nClassroom Integration: Help teacher set up a calm-down corner with these tools.`,
    grade_tags: ['K', '1', '2', '3'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['self-regulation', 'coping skills', 'calm down', 'anger management'],
  },
  {
    title: 'I-Messages: Expressing Feelings Respectfully',
    entry_type: 'text',
    text_content: `Objective: Students use I-Messages ("I feel ___ when ___ because ___. I need ___.") to express feelings without blaming.\n\nMaterials: I-Message formula poster, role-play scenario cards.\n\n1. Opening (5 min): Act out a scenario using "You" language ("You always cut in line! You're so mean!"). Ask: "How would that make you feel? Would it solve the problem?"\n2. Teach the Formula (8 min): Introduce I-Messages. Redo the scenario: "I feel frustrated when someone cuts in front of me because I've been waiting. I need you to go to the back of the line." Compare the two approaches.\n3. Guided Practice (12 min): Pairs draw scenario cards and practice writing and saying I-Messages. Counselor coaches.\n4. Closing (5 min): Whole group — volunteers share their best I-Message. Reinforce: "I-Messages help people listen instead of getting defensive."\n\nHome Connection: Send home I-Message practice sheet for families.`,
    grade_tags: ['2', '3', '4', '5'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['communication', 'conflict resolution', 'assertiveness'],
  },
  {
    title: 'Bullying Prevention: Upstander Training',
    entry_type: 'text',
    text_content: `Objective: Students differentiate bullying from conflict, identify the 4 roles (bully, target, bystander, upstander), and practice upstander strategies.\n\nMaterials: Role definition cards, scenario strips, upstander pledge cards.\n\n1. Opening (5 min): Define bullying — repeated, on purpose, power imbalance. "Is every mean thing bullying?" Discuss the difference.\n2. Four Roles (8 min): Teach bully, target, bystander, upstander with simple definitions. "A bystander watches. An upstander ACTS."\n3. Upstander Strategies (7 min): (a) Say "Stop, that's not cool," (b) Include the target — invite them to join you, (c) Walk away with the target, (d) Tell a trusted adult. Emphasize safety.\n4. Scenario Practice (10 min): Read 4 scenarios. Small groups decide: Is this bullying or conflict? What would an upstander do?\n5. Closing (5 min): Sign the Upstander Pledge: "I will speak up, reach out, or get help when I see someone being treated unfairly."\n\nSchool-Wide Tie-In: Coordinate with Bullying Prevention Month activities.`,
    grade_tags: ['3', '4', '5'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['bullying prevention', 'upstander', 'peer relationships', 'safety'],
  },
  {
    title: 'Managing Worry: The Worry Monster',
    entry_type: 'text',
    text_content: `Objective: Students externalize worry and learn to sort worries into "can control" and "can't control."\n\nMaterials: Paper bags, markers, worry slips, two-column sorting mat.\n\n1. Opening (5 min): "Everyone worries sometimes. That's normal! But sometimes worry gets too big. Today we're going to tame our worries."\n2. Create a Worry Monster (10 min): Students decorate a paper bag as their personal Worry Monster. This is where worries go so they don't have to carry them.\n3. Sorting Activity (10 min): Students write 3 worries on slips. Sort into "Things I Can Control" (studying for a test, being kind) and "Things I Can't Control" (weather, what others think). Discuss: for controllable worries, make a plan. For uncontrollable ones, practice letting go (feed to the Worry Monster).\n4. Closing (5 min): Teach one quick strategy — "5-4-3-2-1 grounding" (5 things you see, 4 hear, 3 touch, 2 smell, 1 taste). Practice together.\n\nFollow-Up: Check in with students who identified significant worries.`,
    grade_tags: ['K', '1', '2', '3'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['anxiety', 'worry', 'coping skills', 'self-regulation'],
  },
  {
    title: 'Empathy Walk: Seeing Others\' Perspectives',
    entry_type: 'text',
    text_content: `Objective: Students define empathy and practice perspective-taking through guided scenarios.\n\nMaterials: "Shoes" cutouts (paper), scenario cards, empathy definition poster.\n\n1. Opening (5 min): Hold up a pair of shoes. "What does 'walking in someone else's shoes' mean?" Define empathy: understanding how someone else feels.\n2. Scenario Stations (15 min): Set up 4 stations around the room, each with a scenario card and paper shoe cutout. Students rotate, read the scenario, and write on the shoe how that person might feel and why. Scenarios: new student at school, student who lost a pet, student struggling with reading, student whose parents are divorcing.\n3. Group Debrief (5 min): Discuss one scenario as a whole group. "Did anyone write something different? Can two people feel different things about the same situation?" Yes — and that's OK.\n4. Closing (5 min): "One way I will show empathy this week is ___."\n\nAssessment: Review shoe responses for depth of perspective-taking.`,
    grade_tags: ['2', '3', '4', '5'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['empathy', 'perspective taking', 'social awareness'],
  },
  {
    title: 'Teamwork Tower Challenge',
    entry_type: 'text',
    text_content: `Objective: Students practice cooperation, communication, and compromise through a hands-on team challenge.\n\nMaterials: 20 index cards + 12 inches of tape per group, timer.\n\n1. Opening (3 min): "Today we're building towers, but the real goal is teamwork. I'll be watching HOW you work together, not just how tall your tower is."\n2. Planning Phase (5 min): Groups of 4 discuss their plan. No building yet — only talking and sketching.\n3. Building Phase (10 min): Build the tallest freestanding tower using only the cards and tape. Counselor observes and notes teamwork behaviors.\n4. Debrief (10 min): Each group shares: What went well? What was hard? Did everyone's ideas get heard? What would you do differently? Connect to classroom and friendship: cooperation requires listening, compromising, and encouraging.\n5. Closing (2 min): "Name one teamwork skill you used today that you can use at recess or in class."\n\nTeacher Note: Great lesson to co-facilitate during a class that's struggling with group dynamics.`,
    grade_tags: ['2', '3', '4', '5'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['teamwork', 'cooperation', 'communication', 'social skills'],
  },
  {
    title: 'Personal Space and Body Boundaries (K-1)',
    entry_type: 'text',
    text_content: `Objective: Students learn about personal space bubbles and practice asking permission before touching others.\n\nMaterials: Hula hoops (1 per student or shared), body boundary coloring page.\n\n1. Opening (5 min): "Everyone has an invisible bubble around them — that's their personal space. When someone gets too close without asking, it can feel uncomfortable."\n2. Bubble Practice (8 min): Each student stands in or near a hula hoop. Practice walking around the room keeping bubbles from overlapping. "If you need to get close, what do you say?" ("Excuse me," "Can I give you a hug?")\n3. Yes/No/Maybe Activity (7 min): Counselor names physical interactions (high five, hug, pat on back, holding hands). Students show thumbs up (yes, I like that), sideways (depends on who), or down (no thanks). Discuss: "Everyone's answers are different, and that's OK. We always ask first."\n4. Closing (5 min): Color the body boundary page — circle the parts that are private, star the ways you like to greet friends.\n\nSafety Note: This lesson supports body safety education. Connect to reporting trusted adults if boundaries are violated.`,
    grade_tags: ['K', '1'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['personal space', 'body boundaries', 'safety', 'consent'],
  },
  {
    title: 'Mindfulness Minute: Breathing Exercises',
    entry_type: 'link',
    url: 'https://www.gonoodle.com/good-energy-at-home/breathing-exercises',
    grade_tags: ['K', '1', '2', '3', '4', '5'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['mindfulness', 'breathing', 'self-regulation', 'calm down'],
  },
  {
    title: 'Tattling vs. Reporting',
    entry_type: 'text',
    text_content: `Objective: Students distinguish between tattling (to get someone IN trouble) and reporting (to get someone OUT of trouble or stay safe).\n\nMaterials: T-chart poster, scenario cards, "Tattle or Report?" sorting mat.\n\n1. Opening (5 min): "Has anyone ever been told 'stop tattling'? Today we'll learn the difference between tattling and reporting — because reporting is ALWAYS OK."\n2. T-Chart (8 min): Build the chart together. Tattling = small problem, no one is hurt, trying to get someone in trouble. Reporting = someone is hurt or could be hurt, someone is being bullied, something is dangerous or scary.\n3. Sorting Activity (10 min): Read scenario cards. Students sort into Tattle or Report. Examples: "He's not sharing the markers" (tattle — try Kelso's choices), "She keeps pushing me every day at recess" (report — that's bullying), "Someone brought something dangerous to school" (report — safety).\n4. Closing (5 min): "When should you ALWAYS tell an adult?" Review the key rule: if someone is hurt, scared, or in danger — report it. You will never get in trouble for reporting.\n\nAlignment: Pairs with Kelso's Choices and Upstander Training.`,
    grade_tags: ['K', '1', '2'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['tattling vs reporting', 'safety', 'problem solving'],
  },
  {
    title: 'Zones of Regulation Introduction',
    entry_type: 'text',
    text_content: `Objective: Students identify the 4 Zones (Blue, Green, Yellow, Red) and match feelings and body signals to each zone.\n\nMaterials: Zones of Regulation poster, feeling word cards, body signal pictures.\n\n1. Opening (5 min): "Our feelings are like a traffic light — they tell us information about how we're doing. Let's learn the 4 Zones."\n2. Teach the Zones (10 min): Blue = low energy, sad, tired, bored. Green = calm, happy, focused, ready to learn (this is our "learning zone"). Yellow = getting frustrated, worried, silly, wiggly, losing control. Red = out of control, angry, terrified, meltdown. Emphasize: no zone is "bad" — all feelings are OK. The goal is to recognize your zone and have tools to get back to green when you need to.\n3. Matching Game (10 min): Students sort feeling word cards and body signal pictures into the correct zone on a 4-column mat.\n4. Closing (5 min): "What zone are you in right now? What's one thing you could do to stay in or get to green?" Quick share.\n\nOngoing: Use Zones language consistently across school. Check in: "What zone are you in?"`,
    grade_tags: ['K', '1', '2', '3'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['zones of regulation', 'emotional awareness', 'self-regulation'],
  },
  {
    title: 'Positive Self-Talk Mirror Activity',
    entry_type: 'text',
    text_content: `Objective: Students replace negative self-talk with positive affirmations.\n\nMaterials: Hand mirrors (or phone camera on selfie mode), affirmation cards, worksheet.\n\n1. Opening (5 min): "That little voice in your head — is it usually nice to you or mean to you?" Discuss how our self-talk affects how we feel and what we try.\n2. Negative vs. Positive (8 min): Show examples side by side. "I'm so stupid" → "This is hard, but I can keep trying." "Nobody likes me" → "I have people who care about me." "I can't do anything right" → "I'm getting better every day." Practice flipping 3 more together.\n3. Mirror Affirmations (10 min): Each student looks in a mirror and says 3 positive statements about themselves: "I am ___. I am good at ___. I am working on ___ and that's OK." Counselor models first.\n4. Closing (5 min): Write your favorite affirmation on a sticky note and put it somewhere you'll see it every day (inside desk, locker, folder).\n\nFollow-Up: Check in next session — "Did you use your affirmation this week?"`,
    grade_tags: ['3', '4', '5'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['positive self-talk', 'self-esteem', 'growth mindset'],
  },
  {
    title: 'Grief and Loss: When Someone We Love Dies',
    entry_type: 'text',
    text_content: `Objective: Students understand that grief is a normal response to loss and learn healthy ways to cope and remember.\n\nMaterials: "The Invisible String" by Patrice Karst, heart-shaped paper, crayons.\n\nNote: Use this lesson for classroom guidance after a school loss, or in a small grief support group. Coordinate with administration first.\n\n1. Read Aloud (8 min): Read "The Invisible String." Key message: love connects us to the people we care about, even when they're far away or have died.\n2. Discussion (7 min): "What happens when someone we love dies? How might we feel?" Normalize the range: sad, angry, confused, numb, even OK sometimes. "All of those feelings are normal. Grief doesn't follow rules."\n3. Remembering Activity (10 min): On the heart-shaped paper, students draw or write a memory of someone they miss (could be a person, a pet, or even a friend who moved away). "Our memories keep that invisible string connected."\n4. Closing (5 min): "If you're feeling really sad about a loss, who can you talk to?" Identify 3 trusted adults. Remind students the counselor's door is always open.\n\nCritical: Follow up individually with any student who appears significantly distressed.`,
    grade_tags: ['K', '1', '2', '3', '4', '5'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['grief', 'loss', 'coping', 'death', 'remembering'],
  },
  {
    title: 'Anger Iceberg: What\'s Underneath?',
    entry_type: 'text',
    text_content: `Objective: Students understand that anger is often a surface emotion covering deeper feelings like hurt, embarrassment, or fear.\n\nMaterials: Iceberg drawing (tip above water = anger, below water = other feelings), scenario cards.\n\n1. Opening (5 min): Show the iceberg image. "When we see an iceberg, we only see the tip. But the biggest part is hidden underwater. Anger works the same way."\n2. Teach the Concept (8 min): Walk through an example: "Marcus yelled at his friend during recess." Above water = anger. Below water = he felt left out, embarrassed that he missed the catch, worried his friends don't like him. "When we only see anger, we miss the real problem."\n3. Scenario Exploration (12 min): Small groups receive a scenario card. They draw the iceberg — what anger looks like on top, and what feelings might be underneath. Groups share.\n4. Closing (5 min): "Next time you feel angry, try to peek below the surface. What's the deeper feeling? That's what really needs attention."\n\nCounselor Note: Excellent for anger management small groups. Pairs with calm-down strategies.`,
    grade_tags: ['3', '4', '5'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['anger management', 'emotional awareness', 'feelings identification'],
  },

  // ── Career Development ──
  {
    title: 'Career Cluster Exploration (3-5)',
    entry_type: 'text',
    text_content: `Objective: Students explore career clusters and connect personal interests to career pathways.\n\nMaterials: Career cluster cards (16 clusters simplified for elementary), interest survey (10 questions), career cluster matching sheet.\n\n1. Opening (5 min): "There are hundreds of different jobs in the world. To make it easier, we group them into clusters — like families of jobs."\n2. Interest Survey (8 min): Students answer 10 simple questions (Do you like building things? Helping animals? Solving puzzles? Performing on stage?) and tally their top 3 interest areas.\n3. Cluster Matching (10 min): Using their top interests, students match to 2-3 career clusters. Counselor provides a simplified chart: likes animals → Agriculture/Natural Resources, likes helping people → Health Science or Human Services, likes computers → Information Technology, etc.\n4. Career Research (5 min): Students pick one career from their matched cluster and write 3 things they'd like to know about it.\n5. Closing (2 min): "Your interests today can help you explore careers tomorrow. We'll learn more about these careers in our next lesson."\n\nExtension: Computer lab follow-up using age-appropriate career exploration websites.`,
    grade_tags: ['3', '4', '5'],
    asca_domain: 'Career',
    topic_tags: ['career clusters', 'career exploration', 'interests'],
  },
  {
    title: 'Community Helpers (K-1)',
    entry_type: 'text',
    text_content: `Objective: Students identify community helpers and understand how different jobs serve the community.\n\nMaterials: Community helper picture cards, "My Community" coloring page, props (hat, stethoscope toy, etc.).\n\n1. Opening (5 min): "Who helps keep our community safe, healthy, and running smoothly?" Brainstorm list.\n2. Community Helper Parade (10 min): Show picture cards one at a time. For each helper, ask: "What do they do? How do they help us? What tools do they use?" Include: police officer, firefighter, doctor/nurse, teacher, mail carrier, farmer, dentist, librarian, construction worker, veterinarian.\n3. Dress-Up Role Play (8 min): Volunteers pick a prop and act out being that community helper. Classmates guess who they are.\n4. Coloring Activity (5 min): Students color and label their favorite community helper on the "My Community" page.\n5. Closing (2 min): "Every job is important because every job helps people. What job do you think is really cool?"\n\nHome Connection: "Ask a family member about their job and what they like about it."`,
    grade_tags: ['K', '1'],
    asca_domain: 'Career',
    topic_tags: ['community helpers', 'career awareness', 'community'],
  },
  {
    title: 'Strengths Inventory: What Am I Good At?',
    entry_type: 'text',
    text_content: `Objective: Students identify personal strengths and connect them to potential career interests.\n\nMaterials: Strengths checklist (20 items: creative, good listener, fast runner, likes reading, kind to animals, good at math, etc.), "My Strengths Shield" template.\n\n1. Opening (5 min): "Everyone is good at something. Today we're going to discover YOUR strengths."\n2. Strengths Checklist (8 min): Students check off strengths that describe them. Counselor reads each item aloud for younger students. Remind: "Being kind IS a strength. Being a good friend IS a strength. It's not just about school subjects."\n3. Strengths Shield (12 min): Students fill in their shield with 4 sections: (1) Something I'm good at in school, (2) Something I'm good at outside school, (3) A way I help others, (4) Something I want to get better at.\n4. Closing (5 min): Partner share — each person tells their partner one strength they see in them. "Sometimes other people notice strengths we don't see in ourselves."\n\nAssessment: Collect shields for portfolio. Use in individual planning conferences.`,
    grade_tags: ['2', '3', '4', '5'],
    asca_domain: 'Career',
    topic_tags: ['strengths', 'self-awareness', 'career identity'],
  },
  {
    title: 'Financial Literacy: Needs vs. Wants (3-5)',
    entry_type: 'text',
    text_content: `Objective: Students differentiate between needs and wants and understand basic money management.\n\nMaterials: Picture cards (food, toys, house, video games, water, medicine, etc.), needs/wants sorting mat, play money.\n\n1. Opening (5 min): "If you had $100, what would you buy?" List ideas. "Are all of those things you NEED, or some you just WANT?"\n2. Define Terms (5 min): Needs = things you must have to survive and be safe (food, shelter, clothing, medical care). Wants = things that are nice to have but you can live without (toys, candy, video games).\n3. Sorting Activity (8 min): Pairs sort 20 picture cards into Needs and Wants columns. Discuss tricky ones (is a phone a need or want? It depends!).\n4. Budget Challenge (10 min): Each group gets $50 in play money and a price list. They must buy all their needs first, then decide how to spend what's left. "Did you have enough for everything you wanted? What choices did you have to make?"\n5. Closing (2 min): "Understanding needs vs. wants helps you make smart choices with money — now and when you grow up."\n\nCareer Connection: "Every job earns money. Budgeting helps you use it wisely."`,
    grade_tags: ['3', '4', '5'],
    asca_domain: 'Career',
    topic_tags: ['financial literacy', 'needs vs wants', 'money management'],
  },
  {
    title: 'STEM Careers: Who Uses Math and Science?',
    entry_type: 'link',
    url: 'https://www.nasa.gov/learning-resources/for-kids-and-students/',
    grade_tags: ['3', '4', '5'],
    asca_domain: 'Career',
    topic_tags: ['STEM', 'career exploration', 'math', 'science'],
  },
  {
    title: 'Responsibility and Dependability',
    entry_type: 'text',
    text_content: `Objective: Students understand what it means to be responsible and dependable, and how these traits connect to future career success.\n\nMaterials: Scenario cards, responsibility self-assessment, certificate template.\n\n1. Opening (5 min): "What does it mean to be responsible?" Brainstorm. Key idea: doing what you're supposed to do, even when no one is watching.\n2. Why It Matters (5 min): "Employers want workers who are responsible. Teachers want students who are responsible. Friends want friends who are responsible. It's one of the most important life skills."\n3. Scenario Discussion (10 min): Read scenarios and rate on a 1-5 responsibility scale. "Maria always turns in homework on time." "Jake said he'd feed the class hamster but forgot three days in a row." "Aisha admitted she made a mistake instead of blaming someone else." Discuss what responsibility looks like in action.\n4. Self-Assessment (5 min): Students rate themselves in 5 areas: homework, chores, promises, honesty, helping others. Pick one area to improve.\n5. Closing (5 min): "Being responsible is a choice you make every day. Start with one small thing this week."\n\nFollow-Up: Responsibility awards at the end of the month for students nominated by teachers.`,
    grade_tags: ['2', '3', '4', '5'],
    asca_domain: 'Career',
    topic_tags: ['responsibility', 'dependability', 'character', 'work ethic'],
  },
  {
    title: 'Digital Citizenship: Safe Online Choices',
    entry_type: 'text',
    text_content: `Objective: Students learn 3 rules for being safe and kind online.\n\nMaterials: "Chicken Clicking" by Jeanne Willis (or similar), digital citizenship poster, pledge cards.\n\n1. Opening (5 min): "How many of you use the internet or play games online?" Hands up. "The internet is an amazing tool, but just like the real world, we need to follow rules to stay safe."\n2. Three Rules (10 min):\n   - PRIVATE: Never share your full name, address, school name, or password with strangers online. "If someone online asks where you live, what do you do?" (Tell a trusted adult immediately.)\n   - KIND: If you wouldn't say it to someone's face, don't type it. Cyberbullying hurts just as much as in-person bullying.\n   - SMART: Not everything online is true. Ask an adult if something seems weird, scary, or too good to be true.\n3. Scenario Sort (8 min): Read online scenarios — students hold up green (safe choice) or red (unsafe choice) cards. Discuss the unsafe ones — what should you do instead?\n4. Closing (5 min): Sign the Digital Citizen Pledge. Post in computer lab.\n\nParent Connection: Send home a family digital safety conversation guide.`,
    grade_tags: ['2', '3', '4', '5'],
    asca_domain: 'Career',
    topic_tags: ['digital citizenship', 'internet safety', 'cyberbullying', 'technology'],
  },
  {
    title: 'Transition to Middle School (5th Grade)',
    entry_type: 'text',
    text_content: `Objective: 5th graders identify fears and excitement about middle school and learn strategies for a successful transition.\n\nMaterials: KWL chart (Know, Want to know, Learned), middle school FAQ handout, letter template.\n\n1. Opening (5 min): "You're about to take a big step — middle school! Let's talk about it." Feelings check: rate your excitement 1-10 and your nervousness 1-10. Both are normal!\n2. KWL Chart (8 min): What do you KNOW about middle school? What do you WANT to know? Fill in first two columns together. Address common fears: lockers, changing classes, harder work, new kids, getting lost.\n3. Middle School Survival Tips (10 min): (a) Use your planner every day, (b) Ask for help early — don't wait until you're failing, (c) Join one activity or club — it's the fastest way to make friends, (d) It's OK to feel nervous — everyone does, even the kids who don't show it, (e) Your elementary counselor and middle school counselor are both here for you.\n4. Letter to Future Self (5 min): Write a letter to your August self: one thing you're proud of from elementary, one thing you're looking forward to, one piece of advice.\n5. Closing (2 min): "You are READY for this. And we're going to make sure you feel prepared."\n\nFollow-Up: Middle school counselor visit, campus tour, and buddy program coordination.`,
    grade_tags: ['5'],
    asca_domain: 'Career',
    topic_tags: ['transition', 'middle school', 'change', 'preparation'],
  },
  {
    title: 'Respect and Diversity: We Are All Different and That\'s Great',
    entry_type: 'text',
    text_content: `Objective: Students appreciate differences among people and practice inclusive behaviors.\n\nMaterials: "The Crayon Box That Talked" by Shane DeRolf, plain white paper, crayons.\n\n1. Read Aloud (7 min): Read the book. Key message: every crayon (person) is different, and the picture is beautiful because of ALL the colors working together.\n2. Discussion (5 min): "What makes you unique? What makes our class special?" Chart 10 ways students are different from each other (languages, foods, hobbies, families, abilities). "Are any of these things bad?" No — they make us interesting.\n3. Crayon Activity (10 min): Give each student one crayon color. Draw a picture using ONLY that color. Then combine with a partner's color. Then with the whole table. "Which picture is better — one color or many?" Connect to real life.\n4. Inclusive Actions (5 min): Brainstorm ways to be inclusive: invite someone new to play, learn about someone's culture, stand up if someone is being teased for being different, ask questions respectfully.\n5. Closing (3 min): "Different is not wrong. Different is interesting. And including everyone makes our school stronger."\n\nSchool-Wide: Coordinate with Multicultural Week or Unity Day.`,
    grade_tags: ['K', '1', '2', '3'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['diversity', 'respect', 'inclusion', 'differences'],
  },
  {
    title: 'SB 179 Time Documentation Template',
    entry_type: 'text',
    text_content: `Objective: This lesson template helps counselors document direct student service time for SB 179 compliance (80% direct/20% indirect).\n\nUsage: Use this as a wrapper template for ANY lesson delivery. Fill in the fields below after each classroom guidance lesson, small group, or individual session.\n\nDocumentation Fields:\n- Date: ___\n- Time Start / End: ___ / ___\n- Total Minutes: ___\n- Service Type: [ ] Classroom Guidance  [ ] Small Group  [ ] Individual  [ ] Crisis Response\n- Grade Level(s): ___\n- Number of Students Served: ___\n- ASCA Domain: [ ] Academic  [ ] Social/Emotional  [ ] Career\n- ASCA Standard Addressed: ___\n- Brief Description of Lesson/Activity: ___\n- Student Outcome/Assessment Notes: ___\n\nThis counts as DIRECT service time toward the 80% requirement. Indirect time (consultation, coordination, paperwork) should be documented separately.\n\nTip: Log this immediately after service delivery for accurate time tracking.`,
    grade_tags: ['K', '1', '2', '3', '4', '5'],
    asca_domain: 'Academic',
    topic_tags: ['SB 179', 'compliance', 'time tracking', 'documentation'],
  },
  {
    title: 'Emotion Charades (K-2)',
    entry_type: 'text',
    text_content: `Objective: Students practice identifying emotions through facial expressions and body language.\n\nMaterials: Emotion cards (happy, sad, angry, scared, surprised, embarrassed, frustrated, excited, lonely, proud), mirror (optional).\n\n1. Opening (5 min): "Can you tell how someone feels without them saying a word? Let's find out!"\n2. Emotion Vocabulary (5 min): Review 10 feeling words with picture cards. For each, ask students to make the face and show the body posture.\n3. Charades Game (12 min): One student draws an emotion card and acts it out (no words!). Class guesses. After each round, discuss: "What clues helped you guess? What does ___ look like on someone's face? In their body?"\n4. Real-Life Connection (3 min): "Why is it important to notice how other people feel?" (So we can be a good friend, help someone who's sad, give space to someone who's angry.)\n5. Closing (5 min): "When you go back to class, try to notice how one classmate is feeling today. If they look sad or lonely, what could you do?"\n\nAdaptation: For shy students, allow them to draw the emotion instead of acting it out.`,
    grade_tags: ['K', '1', '2'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['feelings identification', 'emotional awareness', 'nonverbal communication'],
  },
  {
    title: 'Problem Solving Steps: STOP-THINK-ACT',
    entry_type: 'text',
    text_content: `Objective: Students learn and apply a 3-step problem-solving framework.\n\nMaterials: STOP-THINK-ACT poster, scenario strips, traffic light visual.\n\n1. Opening (5 min): "When you have a problem, do you react right away or think first?" Discuss what happens when we react without thinking (things usually get worse).\n2. Teach the Steps (8 min): Use a traffic light visual.\n   - RED = STOP: Pause. Take a breath. Don't react yet.\n   - YELLOW = THINK: What are my options? What might happen if I try each one? Which choice is safe, fair, and kind?\n   - GREEN = ACT: Choose the best option and try it. If it doesn't work, go back to yellow and think of another option.\n3. Scenario Practice (12 min): Small groups receive scenario strips. They walk through STOP-THINK-ACT for each one and present their solutions to the class.\n4. Closing (5 min): "This week, when you have a problem, try to STOP before you react. Even 3 seconds of thinking can change everything."\n\nClassroom Integration: Post the STOP-THINK-ACT traffic light in every classroom. Teachers can reference it when redirecting behavior.`,
    grade_tags: ['1', '2', '3', '4', '5'],
    asca_domain: 'Social/Emotional',
    topic_tags: ['problem solving', 'impulse control', 'decision making', 'self-regulation'],
  },
];

async function main() {
  const records = lessons.map((l) => ({
    counselor_id: counselorId,
    title: l.title,
    entry_type: l.entry_type,
    link_url: l.url || null,
    content_text: l.text_content || null,
    grade_tags: l.grade_tags,
    domain_tag: l.asca_domain,
    source_platform: null,
    topic_tags: l.topic_tags,
    is_favorite: false,
  }));

  console.log(`Inserting ${records.length} lessons for counselor ${counselorId}...`);

  const { data, error } = await supabase
    .from('lesson_library')
    .insert(records)
    .select('id, title');

  if (error) {
    console.error('Insert error:', error.message);
    process.exit(1);
  }

  console.log(`Successfully inserted ${data.length} lessons.`);
  data.forEach((r) => console.log(`  - ${r.title}`));
}

main();
