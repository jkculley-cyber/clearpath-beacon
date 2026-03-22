/**
 * Bundled communication template seed data for local mode.
 * Extracted from supabase/seed_templates.mjs
 * 15 English + 15 Spanish translations (30 total)
 */
export const SEED_TEMPLATES = [
  // ── English Templates ──────────────────────────────────────────────
  {
    name: 'Initial Referral Acknowledgment',
    language: 'en',
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
    language: 'en',
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
    language: 'en',
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
    language: 'en',
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
    language: 'en',
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
    language: 'en',
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
    language: 'en',
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
    language: 'en',
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
    language: 'en',
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
    language: 'en',
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
    language: 'en',
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
    language: 'en',
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
    language: 'en',
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
    language: 'en',
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

  // ── Spanish Templates ──────────────────────────────────────────────
  {
    name: '[ES] Initial Referral Acknowledgment',
    language: 'es',
    body: `Estimado/a {{parent_name}},

Gracias por comunicarse con nosotros acerca de {{student_name}}. Quiero que sepa que he recibido la referencia y me da mucho gusto poder ser un apoyo para su hijo/a.

Me gustaría programar una llamada telefónica breve o una reunión para conocer mejor sus inquietudes y compartirle cómo nuestro programa de consejería escolar puede ayudar. Por favor, indíqueme algunos horarios que le funcionen y haré lo posible por acomodarme a su disponibilidad.

Mientras tanto, quiero que sepa que {{student_name}} es bienvenido/a a visitarme en la oficina de consejería en cualquier momento que necesite hablar con alguien de confianza.

Quedo al pendiente para platicar con usted.

Con cariño,
{{counselor_name}}
Consejera Escolar`,
  },
  {
    name: '[ES] Session Progress Update',
    language: 'es',
    body: `Estimado/a {{parent_name}},

Quiero compartirle una breve actualización sobre el progreso de {{student_name}} en nuestras sesiones de consejería. Nos hemos reunido {{session_count}} veces hasta ahora, y me complace contarle lo que he observado.

Áreas de Crecimiento:
{{progress_notes}}

Hemos estado trabajando en {{skill_focus}}, y {{student_name}} está mostrando un gran esfuerzo. Seguiré apoyando a su hijo/a y estaré al pendiente de manera regular.

Si tiene alguna pregunta u observación desde casa que le gustaría compartir, siempre valoro su perspectiva. Somos un equipo en el apoyo al éxito de {{student_name}}.

Gracias por ser parte de este equipo,
{{counselor_name}}
Consejera Escolar`,
  },
  {
    name: '[ES] Group Placement Notification',
    language: 'es',
    body: `Estimado/a {{parent_name}},

Le escribo para informarle que {{student_name}} ha sido seleccionado/a para participar en un pequeño grupo de consejería llamado "{{group_name}}." Este grupo se reunirá {{frequency}} durante el día escolar por aproximadamente {{duration}}.

El grupo se enfocará en {{group_topic}}, utilizando actividades divertidas y apropiadas para la edad para desarrollar habilidades importantes. Los estudiantes son elegidos para los grupos con base en recomendaciones de maestros, referencias o necesidades observadas — participar en un grupo es un apoyo positivo, no un castigo.

Detalles del Grupo:
- Nombre del Grupo: {{group_name}}
- Fecha de Inicio: {{start_date}}
- Día/Hora de Reunión: {{schedule}}
- Número de Sesiones: {{total_sessions}}

Por favor firme y devuelva el formulario de permiso adjunto antes del {{due_date}}. Si tiene alguna pregunta o inquietud, con mucho gusto puedo hablar con usted antes de que comience el grupo.

Gracias,
{{counselor_name}}
Consejera Escolar`,
  },
  {
    name: '[ES] Attendance Concern Follow-Up',
    language: 'es',
    body: `Estimado/a {{parent_name}},

Espero que se encuentre bien. Me comunico con usted porque he notado que {{student_name}} ha tenido {{absence_count}} ausencias en lo que va de este {{term}}. Entiendo que las ausencias ocurren por muchas razones, y quiero asegurarme de que todo esté bien y ver si hay algo que podamos hacer para ayudar.

La asistencia regular es uno de los indicadores más importantes del éxito estudiantil, e incluso unos pocos días perdidos pueden hacer más difícil que los estudiantes se mantengan al día y se sientan conectados con la escuela. Quiero trabajar con usted para eliminar cualquier obstáculo que pueda estar dificultando que {{student_name}} llegue a la escuela.

¿Tendría disponibilidad para una breve llamada telefónica el {{suggested_date}}? Estoy aquí para ayudar, no para juzgar — mi único objetivo es asegurarme de que {{student_name}} se sienta apoyado/a.

No dude en comunicarse conmigo,
{{counselor_name}}
Consejera Escolar`,
  },
  {
    name: '[ES] Behavior Improvement Notice',
    language: 'es',
    body: `Estimado/a {{parent_name}},

Quiero ponerme en contacto con usted sobre el comportamiento de {{student_name}} en la escuela recientemente. El {{date}}, {{student_name}} tuvo dificultades con {{behavior_description}}.

Quiero que sepa que hablé con {{student_name}} sobre la situación y conversamos sobre algunas estrategias para tomar mejores decisiones la próxima vez. Hablamos sobre:
{{strategies_discussed}}

Creo que {{student_name}} es un/a niño/a maravilloso/a que todavía está aprendiendo y creciendo. Mi objetivo es ayudar a su hijo/a a desarrollar las habilidades para manejar estas situaciones con éxito. No le escribo para alarmarlo/a — le escribo para que podamos trabajar juntos.

Si desea hablar más sobre esto o compartir algo que haya observado en casa, no dude en comunicarse conmigo. Estamos en el mismo equipo.

Con cariño,
{{counselor_name}}
Consejera Escolar`,
  },
  {
    name: '[ES] MTSS Tier Change Notification',
    language: 'es',
    body: `Estimado/a {{parent_name}},

Como parte del Sistema de Apoyos de Múltiples Niveles (MTSS) de nuestra escuela, revisamos regularmente el progreso de los estudiantes para asegurarnos de que cada niño/a reciba el nivel adecuado de apoyo. Después de nuestra revisión más reciente, el equipo ha recomendado que {{student_name}} pase de {{previous_tier}} a {{new_tier}}.

Lo Que Esto Significa:
{{tier_description}}

Este cambio refleja nuestro compromiso de brindar a {{student_name}} el apoyo más adecuado. Cambiar de nivel no es un castigo ni una etiqueta — es simplemente una forma de asegurarnos de que estamos atendiendo las necesidades de su hijo/a.

El equipo se reunirá nuevamente el {{review_date}} para evaluar el progreso. Mientras tanto, siempre es bienvenido/a a comunicarse con nosotros si tiene preguntas.

Me gustaría programar una breve reunión para hablar de esto con más detalle. Por favor, hágame saber su disponibilidad.

Atentamente,
{{counselor_name}}
Consejera Escolar`,
  },
  {
    name: '[ES] Parent Conference Invitation',
    language: 'es',
    body: `Estimado/a {{parent_name}},

Me gustaría invitarle a una conferencia para hablar sobre el progreso socioemocional de {{student_name}} y cómo podemos apoyar juntos a su hijo/a de la mejor manera.

Fecha Propuesta: {{date}}
Hora: {{time}}
Lugar: {{location}}

Durante nuestra reunión, planeo compartir:
- Observaciones de las interacciones en el salón de clases y en consejería
- Las fortalezas de {{student_name}} y las áreas en las que puede crecer
- Próximos pasos recomendados y estrategias para el hogar

Su perspectiva es muy valiosa, y me encantará escuchar lo que usted observa en casa también. Si el horario propuesto no le funciona, por favor sugiera una alternativa y haré lo posible por acomodarme.

Por favor confirme su asistencia antes del {{rsvp_date}}.

Gracias por dedicar tiempo a esta importante conversación,
{{counselor_name}}
Consejera Escolar`,
  },
  {
    name: '[ES] End of Group Summary',
    language: 'es',
    body: `Estimado/a {{parent_name}},

Me da mucho gusto compartirle que {{student_name}} ha completado exitosamente el grupo de consejería "{{group_name}}"! Durante las últimas {{total_sessions}} sesiones, su hijo/a trabajó muy duro para desarrollar habilidades importantes.

Habilidades Trabajadas:
{{skills_list}}

Lo Que Observé:
{{counselor_observations}}

Recomendaciones para el Hogar:
Para ayudar a reforzar lo que {{student_name}} aprendió, aquí hay algunas cosas que puede intentar en casa:
{{home_strategies}}

Estoy muy orgulloso/a del esfuerzo y crecimiento de {{student_name}} durante este grupo. Si nota alguna inquietud en el futuro, no dude en comunicarse conmigo. Mi puerta siempre está abierta.

¡Felicidades a {{student_name}}!

Con cariño,
{{counselor_name}}
Consejera Escolar`,
  },
  {
    name: '[ES] Crisis Follow-Up',
    language: 'es',
    body: `Estimado/a {{parent_name}},

Le escribo para dar seguimiento a la situación que involucró a {{student_name}} el {{date}}. Quiero asegurarme de que esté al tanto de lo que sucedió y de que su hijo/a esté recibiendo el apoyo que necesita.

Resumen de la Situación:
{{incident_summary}}

Pasos Tomados en la Escuela:
{{school_response}}

Hablé con {{student_name}} y se encuentra {{current_status}}. Seguiré al pendiente de su hijo/a durante los próximos días para asegurarme de que esté bien.

Próximos Pasos Recomendados:
{{recommendations}}

Si tiene alguna inquietud o si algo cambia en casa, por favor comuníquese conmigo de inmediato. Puede contactarme al {{counselor_phone}} o a {{counselor_email}}.

La seguridad y el bienestar de su hijo/a son nuestra máxima prioridad.

Con cariño,
{{counselor_name}}
Consejera Escolar`,
  },
  {
    name: '[ES] Academic Support Check-In',
    language: 'es',
    body: `Estimado/a {{parent_name}},

Espero que se encuentre bien. Quiero comunicarme con usted sobre el progreso académico de {{student_name}}, ya que {{teacher_name}} y yo hemos notado {{academic_observation}}.

Me reuní con {{student_name}} para hablar sobre la escuela y cómo le está yendo. Esto es lo que platicamos:
{{discussion_summary}}

Estas son algunas estrategias que estamos implementando en la escuela:
{{school_strategies}}

Cosas Que Puede Intentar en Casa:
- Establecer un horario fijo de tarea cada día (incluso 15-20 minutos hacen una gran diferencia)
- Preguntar sobre la escuela con preguntas específicas ("¿Qué aprendiste hoy en matemáticas?" en lugar de "¿Cómo te fue en la escuela?")
- Celebrar el esfuerzo, no solo las calificaciones — "¡Vi que trabajaste muy duro en eso!"
- Leer juntos al menos 10 minutos cada noche

Si desea hablar más sobre esto, con gusto puedo programar una llamada o reunión. Juntos, sé que podemos ayudar a {{student_name}} a tener éxito.

Gracias por su apoyo,
{{counselor_name}}
Consejera Escolar`,
  },
  {
    name: '[ES] Social-Emotional Progress Note',
    language: 'es',
    body: `Estimado/a {{parent_name}},

Quiero compartirle noticias positivas sobre el desarrollo socioemocional de {{student_name}}. He observado un crecimiento maravilloso en las siguientes áreas:

{{progress_highlights}}

Específicamente, he notado que {{student_name}} ha estado {{specific_example}}. Esto demuestra una verdadera madurez y el esfuerzo que su hijo/a ha estado poniendo.

En casa, puede seguir apoyando este crecimiento de la siguiente manera:
{{home_reinforcement}}

Gracias por ser un/a compañero/a tan comprometido/a en el desarrollo de {{student_name}}. El trabajo que hace en casa marca una verdadera diferencia, y se nota.

¡Sigue así, {{student_name}}!

Con aprecio,
{{counselor_name}}
Consejera Escolar`,
  },
  {
    name: '[ES] End of Year Summary',
    language: 'es',
    body: `Estimado/a {{parent_name}},

Al cerrar el año escolar {{school_year}}, quiero tomarme un momento para reflexionar sobre el camino de {{student_name}} durante este año.

Logros y Crecimiento:
{{year_highlights}}

Áreas de Fortaleza:
{{strengths}}

Metas para el Próximo Año:
{{summer_goals}}

Recomendaciones para el Verano:
- Seguir leyendo a diario — incluso 15 minutos ayudan a prevenir la pérdida de aprendizaje durante el verano
- Practicar habilidades sociales a través de actividades con amigos, campamentos o actividades comunitarias
- Mantener las rutinas en lo posible (horarios de dormir regulares, límites de tiempo en pantallas)
- Hablar sobre los sentimientos — mantenga la conversación abierta durante el verano

Ha sido un verdadero placer trabajar con {{student_name}} este año. Yo {{will_or_will_not}} continuaré como consejero/a escolar de su hijo/a el próximo año, y {{transition_note}}.

¡Le deseo a su familia un verano maravilloso y lleno de descanso!

Con gratitud,
{{counselor_name}}
Consejera Escolar`,
  },
  {
    name: '[ES] New Student Welcome',
    language: 'es',
    body: `Estimado/a {{parent_name}},

¡Bienvenidos a {{school_name}}! Soy {{counselor_name}}, consejero/a escolar, y me da mucho gusto que {{student_name}} se una a nuestra familia escolar.

Empezar en una escuela nueva puede ser emocionante y también un poco nervioso — tanto para los estudiantes como para los padres. Quiero que sepa que estoy aquí para ayudar a que esta transición sea lo más tranquila posible.

Esto es lo que tengo planeado:
- Me reuniré con {{student_name}} durante la primera semana para presentarme y darle un recorrido por la escuela
- Estaré al pendiente regularmente durante el primer mes para ver cómo van las cosas
- Conectaré a {{student_name}} con un compañero/a para ayudarle a sentirse bienvenido/a

Si hay algo que le gustaría que yo supiera sobre {{student_name}} — actividades favoritas, alguna inquietud, o cómo maneja los cambios — por favor no dude en compartirlo. Entre más sepa, mejor podré apoyar a su hijo/a.

Mi puerta siempre está abierta. ¡Bienvenidos!

Con cariño,
{{counselor_name}}
Consejera Escolar`,
  },
  {
    name: '[ES] Friendship Concern Response',
    language: 'es',
    body: `Estimado/a {{parent_name}},

Gracias por informarme sobre las preocupaciones de {{student_name}} con sus amistades. Le agradezco su confianza, y quiero que sepa que me lo tomo muy en serio.

Ya he tomado los siguientes pasos:
{{steps_taken}}

Los desafíos de amistad son uno de los temas más comunes con los que trabajo a esta edad. Aunque pueden ser muy dolorosos para los niños (y para los padres que lo observan), también son oportunidades para desarrollar habilidades sociales importantes como la comunicación, establecer límites y la resiliencia.

Esto es lo que recomiendo:
{{recommendations}}

En casa, puede ayudar de la siguiente manera:
- Escuchar sin tratar de resolver todo de inmediato — a veces los niños solo necesitan sentirse escuchados
- Hacer preguntas abiertas: "¿Qué pasó después?" "¿Cómo te hizo sentir eso?"
- Evitar hablar negativamente del otro niño/a — los niños frecuentemente se reconcilian rápido
- Practicar respuestas juntos: "¿Qué podrías decir si eso vuelve a pasar?"

Seguiré observando la situación y le mantendré informado/a. Por favor comuníquese conmigo si algo se intensifica o si {{student_name}} comparte nuevas preocupaciones en casa.

Estamos juntos en esto,
{{counselor_name}}
Consejera Escolar`,
  },
];
