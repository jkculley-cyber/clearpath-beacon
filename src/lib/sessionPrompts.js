/**
 * Session prompts for school counselors across all bands.
 * Icebreakers, scenario cards, and mindfulness scripts, tagged by gradeRange
 * (K-5 / K-1 / 2-5 elementary, 6-8 middle, 9-12 high).
 */

export const ICEBREAKERS = [
  // ── K-1 (simple, concrete) ──
  {
    id: 'ice-1',
    text: 'If you were an animal today, which one would you be?',
    gradeRange: 'K-1',
    category: 'icebreaker',
  },
  {
    id: 'ice-2',
    text: 'Show me with your fingers how your day is going — 1 is hard, 5 is great!',
    gradeRange: 'K-1',
    category: 'icebreaker',
  },
  {
    id: 'ice-3',
    text: 'What color matches how you feel right now?',
    gradeRange: 'K-1',
    category: 'icebreaker',
  },
  {
    id: 'ice-4',
    text: 'If you could eat only one food today, what would it be?',
    gradeRange: 'K-1',
    category: 'icebreaker',
  },
  {
    id: 'ice-5',
    text: 'Point to the wall if you feel happy, point to the floor if you feel sad, point to the ceiling if you\'re not sure.',
    gradeRange: 'K-1',
    category: 'icebreaker',
  },
  {
    id: 'ice-6',
    text: 'Tell me one thing that made you smile today.',
    gradeRange: 'K-1',
    category: 'icebreaker',
  },
  {
    id: 'ice-7',
    text: 'If you were the weather today, would you be sunny, rainy, or stormy?',
    gradeRange: 'K-1',
    category: 'icebreaker',
  },
  {
    id: 'ice-8',
    text: 'What is your favorite thing to do at recess?',
    gradeRange: 'K-1',
    category: 'icebreaker',
  },
  {
    id: 'ice-9',
    text: 'If your stuffed animal could talk, what would it say about your day?',
    gradeRange: 'K-1',
    category: 'icebreaker',
  },
  {
    id: 'ice-10',
    text: 'Show me a face that matches how you feel right now.',
    gradeRange: 'K-1',
    category: 'icebreaker',
  },
  // ── 2-5 (more reflective) ──
  {
    id: 'ice-11',
    text: 'If your feelings were weather, what would today be?',
    gradeRange: '2-5',
    category: 'icebreaker',
  },
  {
    id: 'ice-12',
    text: 'What\'s one thing you\'re proud of this week?',
    gradeRange: '2-5',
    category: 'icebreaker',
  },
  {
    id: 'ice-13',
    text: 'If you could have any superpower to help with a problem, what would it be?',
    gradeRange: '2-5',
    category: 'icebreaker',
  },
  {
    id: 'ice-14',
    text: 'On a scale of 1 to 10, how is your day going? What would make it one number higher?',
    gradeRange: '2-5',
    category: 'icebreaker',
  },
  {
    id: 'ice-15',
    text: 'If you could talk to anyone in the world about how you feel, who would it be?',
    gradeRange: '2-5',
    category: 'icebreaker',
  },
  {
    id: 'ice-16',
    text: 'What\'s one thing that\'s been on your mind a lot lately?',
    gradeRange: '2-5',
    category: 'icebreaker',
  },
  {
    id: 'ice-17',
    text: 'If your brain had a volume knob, how loud are your thoughts right now?',
    gradeRange: '2-5',
    category: 'icebreaker',
  },
  {
    id: 'ice-18',
    text: 'What\'s something you wish grown-ups understood about being a kid?',
    gradeRange: '2-5',
    category: 'icebreaker',
  },
  {
    id: 'ice-19',
    text: 'If you could change one thing about this week, what would it be?',
    gradeRange: '2-5',
    category: 'icebreaker',
  },
  {
    id: 'ice-20',
    text: 'Describe your day so far using just three words.',
    gradeRange: '2-5',
    category: 'icebreaker',
  },

  // ── Middle school (6-8) ──
  { id: 'ice-ms-1', text: "If you could instantly master one skill for the rest of middle school, what would it be and why?", gradeRange: '6-8', category: 'icebreaker' },
  { id: 'ice-ms-2', text: "What's one thing people often get wrong about you when they first meet you?", gradeRange: '6-8', category: 'icebreaker' },
  { id: 'ice-ms-3', text: "Describe your ideal weekend in three words — no phones allowed in the description.", gradeRange: '6-8', category: 'icebreaker' },
  { id: 'ice-ms-4', text: "If your group chat had a theme song, what would it be, and what does that say about your friends?", gradeRange: '6-8', category: 'icebreaker' },
  { id: 'ice-ms-5', text: "What's a small thing that instantly makes a bad day feel a little better?", gradeRange: '6-8', category: 'icebreaker' },
  { id: 'ice-ms-6', text: "Would you rather be really good at something no one knows about, or okay at something everyone sees? Why?", gradeRange: '6-8', category: 'icebreaker' },
  { id: 'ice-ms-7', text: "What's one thing you wish adults understood about being your age right now?", gradeRange: '6-8', category: 'icebreaker' },
  { id: 'ice-ms-8', text: "Name a moment recently when you were proud of yourself — even if no one else noticed.", gradeRange: '6-8', category: 'icebreaker' },

  // ── High school (9-12) ──
  { id: 'ice-hs-1', text: "If you could send one honest sentence to yourself as a freshman, what would it say?", gradeRange: '9-12', category: 'icebreaker' },
  { id: 'ice-hs-2', text: "What's something you used to care a lot about that matters less to you now — and what changed?", gradeRange: '9-12', category: 'icebreaker' },
  { id: 'ice-hs-3', text: "When you picture life two years after graduation, what's one feeling you hope you have?", gradeRange: '9-12', category: 'icebreaker' },
  { id: 'ice-hs-4', text: "What's a way you recharge that actually works for you, not just what you're 'supposed' to do?", gradeRange: '9-12', category: 'icebreaker' },
  { id: 'ice-hs-5', text: "Who is someone — famous or not — whose way of handling pressure you'd want to borrow?", gradeRange: '9-12', category: 'icebreaker' },
  { id: 'ice-hs-6', text: "What's one expectation you feel from others that you're still deciding whether to keep?", gradeRange: '9-12', category: 'icebreaker' },
  { id: 'ice-hs-7', text: "Describe a time you changed your mind about something important. What moved you?", gradeRange: '9-12', category: 'icebreaker' },
  { id: 'ice-hs-8', text: "If stress took a day off, what's the first thing you'd actually do with that space?", gradeRange: '9-12', category: 'icebreaker' },
];

export const SCENARIO_CARDS = [
  // ── Playground / Recess ──
  {
    id: 'sc-1',
    scenario: 'A group of kids won\'t let you join their game at recess. What would you do?',
    discussion_questions: [
      'How would it feel to be left out of a game you wanted to play?',
      'What are some respectful ways to ask to join a group?',
      'If they still say no, what could you do to have fun anyway?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'friendship',
  },
  {
    id: 'sc-2',
    scenario: 'Someone cuts in front of you in line. What would you do?',
    discussion_questions: [
      'How does it feel when someone doesn\'t wait their turn?',
      'What\'s the difference between telling a teacher and handling it yourself?',
      'How could you use an I-Message to solve this?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'conflict',
  },
  {
    id: 'sc-3',
    scenario: 'Your friend says something mean about another kid. What would you do?',
    discussion_questions: [
      'How would the other kid feel if they heard what was said?',
      'Does staying quiet mean you agree with what your friend said?',
      'What could you say to your friend without starting a fight?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'integrity',
  },
  {
    id: 'sc-4',
    scenario: 'You see a kid sitting alone at recess every day. What would you do?',
    discussion_questions: [
      'How do you think that kid might be feeling?',
      'What would it mean to them if someone invited them to play?',
      'Have you ever felt alone? What did you wish someone would do?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'empathy',
  },
  {
    id: 'sc-5',
    scenario: 'Someone accidentally knocks you down on the playground. They don\'t say sorry. What would you do?',
    discussion_questions: [
      'Do you think they meant to knock you down? Does that change how you respond?',
      'What might happen if you push them back?',
      'How could you let them know it hurt without being mean?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'conflict',
  },
  {
    id: 'sc-6',
    scenario: 'Your best friend wants to play something different than you. What would you do?',
    discussion_questions: [
      'Is it OK for friends to like different things?',
      'What does compromise look like in this situation?',
      'What would happen if you always had to do what your friend wants?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'friendship',
  },
  {
    id: 'sc-7',
    scenario: 'A kid keeps taking the ball away from others during a game. What would you do?',
    discussion_questions: [
      'How does it feel when someone won\'t share during a game?',
      'What would happen if you grabbed the ball back?',
      'What are some fair ways to solve this without an adult?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'conflict',
  },
  {
    id: 'sc-8',
    scenario: 'You see an older kid pushing a younger kid. What would you do?',
    discussion_questions: [
      'Is this a small problem you can handle alone or a big problem that needs an adult?',
      'What could happen if no one says anything?',
      'What does being an upstander look like here?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'empathy',
  },
  // ── Classroom ──
  {
    id: 'sc-9',
    scenario: 'You see someone looking at your paper during a test. What would you do?',
    discussion_questions: [
      'How would you feel knowing someone copied your work?',
      'Is it your job to stop them, or should you tell the teacher?',
      'What could happen to both of you if the teacher notices?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'integrity',
  },
  {
    id: 'sc-10',
    scenario: 'A friend asks you to let them copy your homework. What would you do?',
    discussion_questions: [
      'Why might your friend be asking — are they struggling or just being lazy?',
      'How is helping someone understand different from letting them copy?',
      'What would you say to keep the friendship but still do the right thing?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'integrity',
  },
  {
    id: 'sc-11',
    scenario: 'Someone makes fun of your answer in class. What would you do?',
    discussion_questions: [
      'How does it feel when someone laughs at you for trying?',
      'Does getting an answer wrong mean you\'re not smart?',
      'What could a teacher or classmate do to make the classroom feel safer?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'empathy',
  },
  {
    id: 'sc-12',
    scenario: 'In a group project, one person isn\'t doing any work. What would you do?',
    discussion_questions: [
      'Why might that person not be participating — are they confused, shy, or choosing not to?',
      'What happens to the whole group when one person doesn\'t contribute?',
      'How could you talk to them about it without being bossy?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'conflict',
  },
  {
    id: 'sc-13',
    scenario: 'The teacher blames you for something you didn\'t do. What would you do?',
    discussion_questions: [
      'How does it feel to be blamed for something that wasn\'t your fault?',
      'What\'s the best way to explain your side calmly?',
      'What might happen if you yell or argue? Is there a better approach?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'conflict',
  },
  {
    id: 'sc-14',
    scenario: 'You don\'t understand the lesson but everyone else seems to. What would you do?',
    discussion_questions: [
      'Do you think you\'re really the only one confused, or might others be too?',
      'What are some ways to ask for help without feeling embarrassed?',
      'What would happen if you never asked and just stayed confused?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'empathy',
  },
  {
    id: 'sc-15',
    scenario: 'Someone keeps talking to you when you\'re trying to focus. What would you do?',
    discussion_questions: [
      'How can you tell them to stop without hurting their feelings?',
      'What if they get upset when you ask for quiet?',
      'Is it OK to set boundaries with friends?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'conflict',
  },
  {
    id: 'sc-16',
    scenario: 'You made a mistake in front of the whole class. What would you do?',
    discussion_questions: [
      'Has anyone ever learned something new without making a mistake first?',
      'What would you say to a friend who made the same mistake?',
      'How can mistakes actually help you learn and grow?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'empathy',
  },
  // ── General Social ──
  {
    id: 'sc-17',
    scenario: 'Your friends dare you to do something you know is wrong. What would you do?',
    discussion_questions: [
      'Why is it so hard to say no to friends?',
      'What might happen if you go along with the dare?',
      'Are they really being good friends if they pressure you?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'peer-pressure',
  },
  {
    id: 'sc-18',
    scenario: 'Someone is spreading a rumor about you. What would you do?',
    discussion_questions: [
      'How does it feel when people talk about you behind your back?',
      'Would spreading a rumor back make things better or worse?',
      'Who could you talk to for help with this situation?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'conflict',
  },
  {
    id: 'sc-19',
    scenario: 'Your friend seems really sad but says "I\'m fine." What would you do?',
    discussion_questions: [
      'Why might someone say they\'re fine when they\'re not?',
      'How can you show you care without being pushy?',
      'When should you tell a trusted adult about a friend who seems sad?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'empathy',
  },
  {
    id: 'sc-20',
    scenario: 'You see someone being bullied but you\'re afraid to say something. What would you do?',
    discussion_questions: [
      'What\'s the difference between being a bystander and being an upstander?',
      'Are there ways to help that don\'t put you in danger?',
      'What could happen if nobody ever speaks up?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'empathy',
  },
  {
    id: 'sc-21',
    scenario: 'A new student starts at your school and doesn\'t know anyone. What would you do?',
    discussion_questions: [
      'What would it feel like to be the new kid with no friends?',
      'What are some simple things you could do to welcome them?',
      'How would it change their whole day if just one person was kind?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'friendship',
  },
  {
    id: 'sc-22',
    scenario: 'Your friend tells you a secret that worries you — someone might get hurt. What would you do?',
    discussion_questions: [
      'What\'s the difference between keeping a fun secret and keeping a dangerous one?',
      'Is telling a trusted adult the same as breaking a promise?',
      'Who are the safe adults you could talk to?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'integrity',
  },
  {
    id: 'sc-23',
    scenario: 'You accidentally break something that belongs to someone else. What would you do?',
    discussion_questions: [
      'What would happen if you tried to hide it instead of telling the truth?',
      'How would you want someone to handle it if they broke something of yours?',
      'Why does being honest, even when it\'s hard, build trust?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'integrity',
  },
  {
    id: 'sc-24',
    scenario: 'Someone says something that hurts your feelings but they say they were "just kidding." What would you do?',
    discussion_questions: [
      'Does saying "just kidding" erase the hurt?',
      'How can you tell the difference between a joke and something mean?',
      'What could you say to let them know it wasn\'t funny to you?',
    ],
    gradeRange: 'K-5',
    category: 'scenario',
    topic: 'conflict',
  },

  // ── Middle school (6-8) ──
  { id: 'sc-ms-1', scenario: "Maya notices her two closest friends have started hanging out without her and posting photos she wasn't invited to. She feels left out and isn't sure if it's on purpose or just how things worked out.", discussion_questions: ["What are some different reasons this could be happening that aren't about Maya doing something wrong?", "How could Maya check in with her friends without starting a fight?", "What could Maya do to take care of her own feelings while she figures it out?"], gradeRange: '6-8', category: 'scenario' },
  { id: 'sc-ms-2', scenario: "During a group project, one member keeps saying he'll do his part but never does. The deadline is tomorrow and the rest of the group is stressed and starting to blame each other.", discussion_questions: ["What's the difference between solving the problem and just venting about it?", "How could the group talk to the member without attacking him?", "When is it fair to ask a teacher for help, and how would you do that respectfully?"], gradeRange: '6-8', category: 'scenario' },
  { id: 'sc-ms-3', scenario: "Jordan sees a group chat where classmates are making fun of another student's post. People keep adding comments, and Jordan is expected to say something too. Jordan doesn't want to join in but also doesn't want to be the next target.", discussion_questions: ["What are the risks and the values Jordan is weighing here?", "What are some ways to not participate without making yourself a target?", "How might the student being talked about feel, and does that change what you'd do?"], gradeRange: '6-8', category: 'scenario' },
  { id: 'sc-ms-4', scenario: "Sam has a big test tomorrow and a project due, but every time Sam sits down to study, the work feels overwhelming and Sam ends up scrolling on their phone instead. Now it's late and almost nothing is done.", discussion_questions: ["What might be underneath the scrolling — boredom, stress, something else?", "What's one small first step that would feel doable instead of tackling everything at once?", "How could Sam set up their space or phone to make focusing easier next time?"], gradeRange: '6-8', category: 'scenario' },
  { id: 'sc-ms-5', scenario: "A new student, Priya, keeps changing how she dresses and talks depending on which group she's near. A friend asks her, 'Why are you being so fake?' Priya says she's just trying to figure out where she fits.", discussion_questions: ["What's the difference between exploring who you are and losing yourself to fit in?", "Why might someone act differently around different groups?", "How can friends support each other while they're still figuring themselves out?"], gradeRange: '6-8', category: 'scenario' },
  { id: 'sc-ms-6', scenario: "Devon gets a lower grade than expected and immediately thinks, 'I'm just bad at this — there's no point trying.' Devon starts skipping the homework for that class because it feels pointless.", discussion_questions: ["How does the thought 'I'm just bad at this' affect what Devon does next?", "What's a more accurate and helpful way Devon could describe the situation?", "Who or what could Devon reach out to before giving up on the class?"], gradeRange: '6-8', category: 'scenario' },

  // ── High school (9-12) ──
  { id: 'sc-hs-1', scenario: "Alex is taking several demanding classes, works a part-time job, and is trying to keep up a social life. Lately Alex feels wired but exhausted, snaps at people, and can't remember the last time they felt rested.", discussion_questions: ["What signals is Alex's body and mood sending, and why do they matter?", "If Alex can't drop any commitments right now, what small changes could still help?", "When does 'pushing through' stop being helpful, and who could Alex talk to?"], gradeRange: '9-12', category: 'scenario' },
  { id: 'sc-hs-2', scenario: "Everyone in Riley's family assumes Riley will go to a four-year university, but Riley is genuinely interested in a trade program instead. Riley is nervous to bring it up and has started avoiding conversations about the future.", discussion_questions: ["What makes this conversation feel risky for Riley?", "How could Riley share their thinking in a way that invites a real discussion?", "What's the difference between considering others' input and living out their expectations?"], gradeRange: '9-12', category: 'scenario' },
  { id: 'sc-hs-3', scenario: "Taylor's partner texts constantly and gets upset when Taylor spends time with friends or doesn't reply quickly. Taylor cares about them but has started feeling anxious and cut off from other people.", discussion_questions: ["What's the difference between someone caring about you and someone controlling your time?", "What might Taylor want to say about their own needs in the relationship?", "Who could Taylor talk to if they're unsure whether the relationship feels healthy?"], gradeRange: '9-12', category: 'scenario' },
  { id: 'sc-hs-4', scenario: "Cameron has been putting off a major assignment for weeks. Now it's worth a large part of the grade and due in two days. Cameron feels frozen — the size of it makes it hard to even start.", discussion_questions: ["Why can a task actually get harder to start the longer we avoid it?", "How could Cameron break this down so the first move feels manageable?", "What's a self-respecting way to talk to a teacher if Cameron needs more time or help?"], gradeRange: '9-12', category: 'scenario' },
  { id: 'sc-hs-5', scenario: "Jordan scrolls through classmates' posts about internships, acceptances, and plans, and starts feeling like everyone has life figured out except them. The feeling lingers long after Jordan puts the phone down.", discussion_questions: ["How accurate is the picture we get of other people's lives online?", "What's the cost of measuring your progress against a highlight reel?", "What could Jordan focus on that's actually within their own control?"], gradeRange: '9-12', category: 'scenario' },
  { id: 'sc-hs-6', scenario: "In class, Morgan doesn't understand the material but is afraid that asking a question will make them look behind. Morgan stays quiet, and the confusion keeps building week after week.", discussion_questions: ["What story is Morgan telling themselves about what asking for help means?", "What's actually likely to happen — for grades and stress — if the confusion keeps building?", "What are some low-pressure ways Morgan could advocate for the help they need?"], gradeRange: '9-12', category: 'scenario' },
];

export const MINDFULNESS_SCRIPTS = [
  {
    id: 'mind-1',
    title: 'Balloon Breathing',
    script: `Close your eyes or look at one spot on the floor. We're going to blow up a pretend balloon. Put your hands on your belly. Breathe in slowly through your nose... 1... 2... 3... Feel your belly push out like a balloon getting bigger. Now breathe out slowly through your mouth... 1... 2... 3... 4... Feel your balloon get smaller. Let's do that three more times together. Breathe in... your balloon gets big... breathe out... it gets small. One more time, nice and slow. Breathe in... and out. When you're ready, open your eyes. Notice how your body feels right now.`,
    duration: '30 seconds',
    gradeRange: 'K-5',
    category: 'mindfulness',
  },
  {
    id: 'mind-2',
    title: 'Body Scan for Kids',
    script: `Find a comfortable way to sit. You can close your eyes or look down at your desk. We're going to pay attention to each part of our body, starting at the very bottom and working our way up. Take one deep breath in... and out. Now think about your toes. Can you feel them in your shoes? Wiggle them just a little and then let them be still. Now move up to your feet. Just notice them resting on the floor. You don't need to do anything — just notice. Now think about your legs. Are they tense or relaxed? Let them feel heavy, like they're sinking into the chair. Move up to your belly. Put one hand there. Feel it rise and fall as you breathe. Nice and easy. Now notice your hands. Let them rest on your lap. Let your fingers go loose, like cooked spaghetti. Think about your shoulders. Are they scrunched up near your ears? Let them drop down. Relax. Now your neck — let your head feel balanced and easy on top. Finally, notice your face. Let your jaw relax. Unclench your teeth. Smooth out your forehead. Let your eyes rest. Take one more deep breath in... and let it all the way out. Your whole body is calm and relaxed. When you're ready, slowly open your eyes and look around the room. Notice how peaceful you feel.`,
    duration: '2 minutes',
    gradeRange: '2-5',
    category: 'mindfulness',
  },
  {
    id: 'mind-3',
    title: 'Five Finger Breathing',
    script: `Hold one hand up in front of you with your fingers spread wide like a star. Take the pointer finger of your other hand and put it at the bottom of your thumb. We're going to trace up and down each finger while we breathe. Ready? Slide your finger UP your thumb and breathe IN... now slide DOWN the other side and breathe OUT. Slide UP your pointer finger, breathe IN... slide DOWN, breathe OUT. Up your middle finger, breathe IN... down, breathe OUT. Up your ring finger, breathe IN... down, breathe OUT. Up your pinky, breathe IN... and down, breathe OUT. That was five breaths! Let's do it one more time, even slower. Up your thumb... in... down... out. Up your pointer... in... down... out. Up your middle finger... in... down... out. Up your ring finger... in... down... out. Up your pinky... in... down... out. Now put your hands in your lap. Notice how calm and slow your breathing is. You can do this anytime you feel upset, worried, or angry — right at your desk, and nobody even has to know.`,
    duration: '1 minute',
    gradeRange: 'K-5',
    category: 'mindfulness',
  },
  {
    id: 'mind-4',
    title: 'Safe Place Visualization',
    script: `Close your eyes and take three slow breaths. In... and out. In... and out. In... and out. Now I want you to imagine a place where you feel completely safe and happy. It can be a real place or a made-up place. Maybe it's your bedroom. Maybe it's a beach. Maybe it's a treehouse or a cozy blanket fort. Picture that place in your mind right now. Look around your safe place. What do you see? Are there colors? Is it bright or soft and dim? What's on the ground — sand, grass, a fluffy carpet? Now listen. What do you hear in your safe place? Maybe waves, or birds singing, or soft music, or maybe it's perfectly quiet. Take a deep breath. What does your safe place smell like? Maybe fresh cookies, or flowers, or rain, or clean laundry. Now notice how your body feels in this place. Your shoulders are relaxed. Your jaw is soft. Your hands are still. You feel warm and safe. Nobody is rushing you. Nobody needs anything from you right now. This is YOUR place. Stay here for a moment and enjoy it. Remember — you can come back to this place anytime. All you have to do is close your eyes and breathe. No one can take your safe place away. Now slowly start to hear the sounds of our room again. Wiggle your fingers. Wiggle your toes. And when you're ready, gently open your eyes. Welcome back.`,
    duration: '3 minutes',
    gradeRange: '2-5',
    category: 'mindfulness',
  },
  {
    id: 'mind-5',
    title: 'Counting Colors',
    script: `Keep your eyes open for this one. We're going to play a noticing game to help our brains calm down. Sit up tall and take one deep breath. Now, without getting out of your seat, look around the room. Find 5 things that are BLUE. Count them silently in your head. Got 5? Good. Now find 4 things that are RED. Look carefully — red can hide in surprising places. Found them? OK. Now find 3 things that are GREEN. Take your time. Now find 2 things that are YELLOW. And finally, find 1 thing that is PURPLE. Take one more deep breath in... and out. Did you notice that while you were counting colors, your brain stopped worrying about other things? That's because you were being mindful — paying attention to right here, right now. Anytime your brain feels too busy or worried, you can play this game. Count colors, count shapes, count sounds — anything that brings your attention back to right now.`,
    duration: '1 minute',
    gradeRange: 'K-2',
    category: 'mindfulness',
  },
  {
    id: 'mind-6',
    title: 'Progressive Muscle Relaxation for Kids',
    script: `We're going to play a game where we squeeze our muscles really tight and then let them go. This helps our body let go of stress. Ready? Start with your hands. Pretend you're squeezing two lemons as hard as you can. Squeeze, squeeze, squeeze! Hold it... and now drop the lemons. Let your hands go floppy. Feel how different that is. Now scrunch up your shoulders. Push them way up to your ears like a turtle going into its shell. Hold it tight... and now let them drop. Ahh, that feels nice. Now your face. Scrunch up your whole face like you just ate the sourest lemon ever. Squeeze your eyes, your nose, your mouth. Hold it... and relax. Let your face go smooth. Now your belly. Tighten your tummy muscles like someone is about to tickle you. Hold it tight... and release. Let your belly be soft. Now your legs. Push your feet hard into the floor and tighten your leg muscles. Make them stiff like a board. Hold it... and let go. Let your legs feel heavy and loose. Finally, squeeze EVERYTHING at once — hands, shoulders, face, belly, legs — squeeze it ALL. Hold it... hold it... and LET IT ALL GO. Take a big breath in... and let it out with a sigh. Your whole body is loose and relaxed like a rag doll. Notice how different your body feels now compared to when we started. You just told your muscles it's OK to relax. You can do this anytime you feel tense or stressed.`,
    duration: '2 minutes',
    gradeRange: '1-5',
    category: 'mindfulness',
  },

  // ── Middle school (6-8) ──
  { id: 'mind-ms-1', title: 'Five Senses Grounding', script: "Let's settle for a moment. Plant both feet on the floor and let your hands rest. Now, quietly notice five things you can see around you — really look at them. Next, four things you can feel: your feet in your shoes, the chair, the air on your skin. Now three things you can hear, near or far. Then two things you can smell, or two smells you like. And finally, one slow breath, just for you. Notice that right now, in this moment, you are okay.", duration: '2 minutes', gradeRange: '6-8', category: 'mindfulness' },
  { id: 'mind-ms-2', title: 'Box Breathing', script: "We're going to breathe in a slow, steady square. Sit tall and relax your shoulders. Breathe in through your nose while I count to four — one, two, three, four. Hold it gently — one, two, three, four. Now breathe out slowly — one, two, three, four. And hold empty — one, two, three, four. Let's do that a few more times on your own. In, hold, out, hold. If your mind wanders, that's normal — just come back to the counting.", duration: '2-3 minutes', gradeRange: '6-8', category: 'mindfulness' },
  { id: 'mind-ms-3', title: 'Quick Body Check-In', script: "Close your eyes if you're comfortable, or just lower your gaze. We're going to scan through your body without changing anything — just noticing. Start at the top of your head, and slowly move your attention down: your face, your jaw, your shoulders. Notice where you might be holding tension. Move down through your arms and hands, your chest and stomach, all the way to your feet. Wherever you find tightness, imagine your next breath softening it, just a little. You don't have to fix anything — just notice.", duration: '3 minutes', gradeRange: '6-8', category: 'mindfulness' },
  { id: 'mind-ms-4', title: 'Naming the Feeling', script: "Take one slow breath and check in with yourself. What are you feeling right now? See if you can put one word to it — maybe stressed, tired, annoyed, or calm. There's no wrong answer, and you don't have to share it. Just naming a feeling can make it feel a little less overwhelming. Now say quietly to yourself, 'I'm feeling this right now, and feelings pass.' Take one more breath, and know you can carry this small skill with you the rest of the day.", duration: '2 minutes', gradeRange: '6-8', category: 'mindfulness' },

  // ── High school (9-12) ──
  { id: 'mind-hs-1', title: '5-4-3-2-1 Grounding', script: "When your mind is racing, this brings you back to now. Let your breath settle. Silently name five things you can see — notice detail, color, texture. Then four things you can physically feel touching your body. Then three sounds in the space around you. Then two things you can smell, or two scents you find calming. And finally one slow, full breath. Anxiety pulls us into the future; this pulls you back to the present, where you actually are. You can use this anywhere, and no one will even know.", duration: '2-3 minutes', gradeRange: '9-12', category: 'mindfulness' },
  { id: 'mind-hs-2', title: 'Box Breathing for Stress', script: "Your nervous system responds to slow breathing, so let's use that. Sit tall, unclench your jaw, and drop your shoulders. Inhale through your nose for a count of four. Hold for four. Exhale slowly for four. Hold empty for four. Keep the square going on your own for a few rounds. As you breathe out, imagine releasing a bit of the pressure you're carrying. You can't always control what's stressing you, but you can steady the one thing that's always with you — your breath.", duration: '3 minutes', gradeRange: '9-12', category: 'mindfulness' },
  { id: 'mind-hs-3', title: 'Body Scan Reset', script: "Find a comfortable position and let your eyes close or soften. We're going to move attention slowly through your body, just observing. Begin at your scalp and forehead — let them relax. Move to your jaw and neck, your shoulders, so many of us carry stress there. Continue down through your arms, your chest, the rise and fall of your stomach, your hips, your legs, all the way to your feet. Wherever you notice gripping or tightness, breathe into it and let it loosen slightly. Nothing to achieve here — just returning to your body after a busy day.", duration: '4 minutes', gradeRange: '9-12', category: 'mindfulness' },
  { id: 'mind-hs-4', title: 'Unhooking From a Thought', script: "Bring to mind a stressful thought that's been looping — maybe 'I'm going to fail' or 'I can't handle this.' Now, instead of arguing with it, add four words in front: 'I'm having the thought that…' Notice how that creates a little space — you are the one noticing the thought, not the thought itself. Thoughts are mental events, not facts or commands. Take a slow breath. The thought can be there, and you can still choose your next small step. You're allowed to hold a hard thought lightly.", duration: '3 minutes', gradeRange: '9-12', category: 'mindfulness' },
];
