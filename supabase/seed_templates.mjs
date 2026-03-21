/**
 * Seed communication_templates with 12+ parent contact templates.
 *
 * Usage:
 *   node supabase/seed_templates.mjs <counselor_id>
 *   COUNSELOR_ID=<uuid> node supabase/seed_templates.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cghhabcbgyoqwqjzunfo.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnaGhhYmNiZ3lvcXdxanp1bmZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzU4NDQsImV4cCI6MjA4ODE1MTg0NH0.y2qpi6U9tMfTvgZjqGD_csx5VImCbuNNG8Awq3VKskg';

const counselorId = process.argv[2] || process.env.COUNSELOR_ID;
if (!counselorId) {
  console.error('Usage: node supabase/seed_templates.mjs <counselor_id>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const templates = [
  {
    name: 'Initial Referral Acknowledgment',
    body: `Dear {{parent_name}},

Thank you for reaching out regarding {{student_name}}. I wanted to let you know that I have received the referral and am glad to be a support for your child.

I would like to schedule a brief phone call or meeting to learn more about your concerns and share how our school counseling program can help. Please let me know a few times that work for your schedule, and I will do my best to accommodate.

In the meantime, please know that {{student_name}} is welcome to visit me in the counseling office any time they need a safe person to talk to.

Looking forward to connecting with you.

Warmly,
{{counselor_name}}
School Counselor`,
  },
  {
    name: 'Session Progress Update',
    body: `Dear {{parent_name}},

I wanted to share a quick update on {{student_name}}'s progress in our counseling sessions. We have met {{session_count}} times so far, and I am pleased to share what I have been observing.

Areas of Growth:
{{progress_notes}}

We have been working on {{skill_focus}}, and {{student_name}} is showing great effort. I will continue to support your child and check in regularly.

If you have any questions or observations from home that you would like to share, I always welcome your input. We are a team in supporting {{student_name}}'s success.

Thank you for your partnership,
{{counselor_name}}
School Counselor`,
  },
  {
    name: 'Group Placement Notification',
    body: `Dear {{parent_name}},

I am writing to let you know that {{student_name}} has been selected to participate in a small counseling group called "{{group_name}}." This group will meet {{frequency}} during the school day for approximately {{duration}}.

The group will focus on {{group_topic}}, using fun and age-appropriate activities to build important skills. Students are chosen for groups based on teacher recommendations, referrals, or observed needs — participation in a group is a positive support, not a consequence.

Group Details:
- Group Name: {{group_name}}
- Start Date: {{start_date}}
- Meeting Day/Time: {{schedule}}
- Number of Sessions: {{total_sessions}}

Please sign and return the attached permission form by {{due_date}}. If you have any questions or concerns, I am happy to speak with you before the group begins.

Thank you,
{{counselor_name}}
School Counselor`,
  },
  {
    name: 'Attendance Concern Follow-Up',
    body: `Dear {{parent_name}},

I hope this message finds you well. I am reaching out because I have noticed that {{student_name}} has had {{absence_count}} absences so far this {{term}}. I understand that absences happen for many reasons, and I want to make sure everything is OK and see if there is anything we can do to help.

Regular attendance is one of the strongest predictors of student success, and even a few missed days can make it harder for students to keep up and feel connected. I want to work with you to remove any barriers that might be making it difficult for {{student_name}} to get to school.

Would you be available for a brief phone call on {{suggested_date}} to chat? I am here to help, not to judge — my goal is simply to make sure {{student_name}} feels supported.

Please do not hesitate to reach out,
{{counselor_name}}
School Counselor`,
  },
  {
    name: 'Behavior Improvement Notice',
    body: `Dear {{parent_name}},

I wanted to touch base with you about {{student_name}}'s behavior at school recently. On {{date}}, {{student_name}} had difficulty with {{behavior_description}}.

I want you to know that I spoke with {{student_name}} about the situation, and we talked about some strategies for making better choices next time. We discussed:
{{strategies_discussed}}

I believe {{student_name}} is a wonderful kid who is still learning and growing. My goal is to help your child develop the skills to handle these situations successfully. I am not writing to alarm you — I am writing so we can work together.

If you would like to discuss this further or share any observations from home, please feel free to contact me. We are on the same team.

With care,
{{counselor_name}}
School Counselor`,
  },
  {
    name: 'MTSS Tier Change Notification',
    body: `Dear {{parent_name}},

As part of our school's Multi-Tiered System of Supports (MTSS), we regularly review student progress to ensure every child is receiving the right level of support. After our most recent review, the team has recommended that {{student_name}} move from {{previous_tier}} to {{new_tier}}.

What This Means:
{{tier_description}}

This change reflects our commitment to providing {{student_name}} with the most appropriate support. Moving to a different tier is not a punishment or a label — it is simply a way for us to make sure we are meeting your child's needs.

The team will meet again on {{review_date}} to assess progress. In the meantime, you are always welcome to reach out with questions.

I would like to schedule a brief meeting to discuss this in more detail. Please let me know your availability.

Sincerely,
{{counselor_name}}
School Counselor`,
  },
  {
    name: 'Parent Conference Invitation',
    body: `Dear {{parent_name}},

I would like to invite you to a conference to discuss {{student_name}}'s social-emotional progress and how we can best support your child together.

Proposed Date: {{date}}
Time: {{time}}
Location: {{location}}

During our meeting, I plan to share:
- Observations from classroom and counseling interactions
- {{student_name}}'s strengths and areas for growth
- Recommended next steps and home strategies

Your perspective is invaluable, and I look forward to hearing about what you are seeing at home as well. If the proposed time does not work, please suggest an alternative and I will do my best to accommodate.

Please confirm your attendance by {{rsvp_date}}.

Thank you for making time for this important conversation,
{{counselor_name}}
School Counselor`,
  },
  {
    name: 'End of Group Summary',
    body: `Dear {{parent_name}},

I am happy to share that {{student_name}} has successfully completed the "{{group_name}}" counseling group! Over the past {{total_sessions}} sessions, your child worked hard on building important skills.

Skills Covered:
{{skills_list}}

What I Observed:
{{counselor_observations}}

Recommendations for Home:
To help reinforce what {{student_name}} learned, here are a few things you can try at home:
{{home_strategies}}

I am so proud of {{student_name}}'s effort and growth during this group. If you notice any concerns in the future, please do not hesitate to reach out. My door is always open.

Congratulations to {{student_name}}!

Warmly,
{{counselor_name}}
School Counselor`,
  },
  {
    name: 'Crisis Follow-Up',
    body: `Dear {{parent_name}},

I am writing to follow up on the situation involving {{student_name}} on {{date}}. I want to make sure you are aware of what happened and that your child is receiving the support they need.

Summary of the Situation:
{{incident_summary}}

Steps Taken at School:
{{school_response}}

I spoke with {{student_name}} and they are {{current_status}}. I will continue to check in with your child over the next several days to ensure they are doing well.

Recommended Next Steps:
{{recommendations}}

If you have any concerns or if anything changes at home, please contact me immediately. You can reach me at {{counselor_phone}} or {{counselor_email}}.

Your child's safety and well-being are our top priority.

With care,
{{counselor_name}}
School Counselor`,
  },
  {
    name: 'Academic Support Check-In',
    body: `Dear {{parent_name}},

I hope you are doing well. I wanted to check in about {{student_name}}'s academic progress, as {{teacher_name}} and I have noticed {{academic_observation}}.

I met with {{student_name}} to talk about school and how things are going. Here is what we discussed:
{{discussion_summary}}

Here are some strategies we are putting in place at school:
{{school_strategies}}

Things You Can Try at Home:
- Set a consistent homework time each day (even 15-20 minutes makes a difference)
- Ask about school using specific questions ("What did you learn in math today?" instead of "How was school?")
- Celebrate effort, not just grades — "I noticed you worked really hard on that!"
- Read together for at least 10 minutes each night

If you would like to discuss further, I am happy to set up a call or meeting. Together, I know we can help {{student_name}} succeed.

Thank you for your support,
{{counselor_name}}
School Counselor`,
  },
  {
    name: 'Social-Emotional Progress Note',
    body: `Dear {{parent_name}},

I wanted to share some positive news about {{student_name}}'s social-emotional development. I have been observing wonderful growth in the following areas:

{{progress_highlights}}

Specifically, I noticed that {{student_name}} has been {{specific_example}}. This shows real maturity and the hard work your child has been putting in.

At home, you can continue to support this growth by:
{{home_reinforcement}}

Thank you for being such a supportive partner in {{student_name}}'s development. The work you do at home makes a real difference, and it shows.

Keep up the great work, {{student_name}}!

Best,
{{counselor_name}}
School Counselor`,
  },
  {
    name: 'End of Year Summary',
    body: `Dear {{parent_name}},

As we wrap up the {{school_year}} school year, I wanted to take a moment to reflect on {{student_name}}'s journey this year.

Highlights and Growth:
{{year_highlights}}

Areas of Strength:
{{strengths}}

Goals for Next Year:
{{summer_goals}}

Summer Recommendations:
- Continue reading daily — even 15 minutes helps prevent the "summer slide"
- Practice social skills through playdates, camps, or community activities
- Maintain routines as much as possible (regular bedtimes, screen time limits)
- Talk about feelings — keep the conversation going over the summer

It has been a true pleasure working with {{student_name}} this year. I {{will_or_will_not}} continue as your child's school counselor next year, and {{transition_note}}.

Wishing your family a wonderful, restful summer!

With gratitude,
{{counselor_name}}
School Counselor`,
  },
  {
    name: 'New Student Welcome',
    body: `Dear {{parent_name}},

Welcome to {{school_name}}! I am {{counselor_name}}, the school counselor, and I am so glad {{student_name}} is joining our school family.

Starting at a new school can be exciting and a little nerve-wracking — for both students and parents. I want you to know that I am here to help make this transition as smooth as possible.

Here is what I have planned:
- I will meet with {{student_name}} during the first week to introduce myself and give a tour
- I will check in regularly during the first month to see how things are going
- I will connect {{student_name}} with a buddy to help them feel welcome

If there is anything you would like me to know about {{student_name}} — favorite activities, any concerns, or ways your child handles change — please do not hesitate to share. The more I know, the better I can support your child.

My door is always open. Welcome aboard!

Warmly,
{{counselor_name}}
School Counselor`,
  },
  {
    name: 'Friendship Concern Response',
    body: `Dear {{parent_name}},

Thank you for letting me know about {{student_name}}'s friendship concerns. I appreciate you trusting me with this, and I want you to know I take it seriously.

I have already taken the following steps:
{{steps_taken}}

Friendship challenges are one of the most common issues I work with at this age. While they can be very painful for children (and for parents watching), they are also opportunities to build important social skills like communication, boundary-setting, and resilience.

Here is what I recommend:
{{recommendations}}

At home, you can help by:
- Listening without trying to fix it right away — sometimes kids just need to feel heard
- Asking open-ended questions: "What happened next?" "How did that make you feel?"
- Avoiding speaking negatively about the other child — kids often reconcile quickly
- Role-playing responses: "What could you say if that happens again?"

I will continue to monitor the situation and keep you updated. Please reach out if anything escalates or if {{student_name}} shares new concerns at home.

We are in this together,
{{counselor_name}}
School Counselor`,
  },
];

async function main() {
  const records = templates.map((t) => ({
    counselor_id: counselorId,
    name: t.name,
    body: t.body,
  }));

  console.log(`Inserting ${records.length} communication templates for counselor ${counselorId}...`);

  const { data, error } = await supabase
    .from('communication_templates')
    .insert(records)
    .select('id, name');

  if (error) {
    console.error('Insert error:', error.message);
    process.exit(1);
  }

  console.log(`Successfully inserted ${data.length} templates.`);
  data.forEach((r) => console.log(`  - ${r.name}`));
}

main();
