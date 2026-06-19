/* =====================================================================
 * questions.js — TOEIC Game question bank
 * ---------------------------------------------------------------------
 * Four modes, each an array of question objects. The game engine
 * (app.js) reads from QUESTION_BANK[mode].
 *
 * Question shape:
 *   {
 *     q:        string   // the prompt / sentence with a blank (____)
 *     choices:  string[] // 4 answer options
 *     answer:   number   // index (0-3) of the correct choice
 *     explain:  string   // shown on the results review screen
 *     passage?: string   // (reading) the text to read before the question
 *     audio?:   string   // (listening) the sentence spoken aloud (TTS)
 *   }
 * ===================================================================== */

const QUESTION_BANK = {
  /* ============================ VOCABULARY ============================ */
  vocabulary: [
    {
      q: "The new manager was praised for her ability to ____ complex problems quickly.",
      choices: ["resolve", "dissolve", "evolve", "revolve"],
      answer: 0,
      explain: "“Resolve” means to solve or settle a problem. The others relate to dissolving, developing, or rotating.",
    },
    {
      q: "Our company offers a ____ discount to customers who pay within ten days.",
      choices: ["substantial", "substantive", "subsequent", "submissive"],
      answer: 0,
      explain: "“Substantial” means large in amount — a substantial discount. The others mean meaningful, following, or obedient.",
    },
    {
      q: "Please ____ to the attached document for further instructions.",
      choices: ["refer", "prefer", "defer", "infer"],
      answer: 0,
      explain: "“Refer to” means to consult or look at. Prefer = like more, defer = postpone, infer = conclude.",
    },
    {
      q: "The factory had to ____ production because of a shortage of raw materials.",
      choices: ["suspend", "expend", "append", "depend"],
      answer: 0,
      explain: "“Suspend” means to temporarily stop. Expend = spend, append = add, depend = rely.",
    },
    {
      q: "A reliable supplier is ____ to keeping our customers satisfied.",
      choices: ["essential", "optional", "reluctant", "tentative"],
      answer: 0,
      explain: "“Essential” means absolutely necessary — the correct fit for keeping customers satisfied.",
    },
    {
      q: "The board will ____ the budget proposal at next week's meeting.",
      choices: ["review", "preview", "renew", "revise"],
      answer: 0,
      explain: "“Review” means to examine or assess. The board reviews proposals before approving them.",
    },
    {
      q: "Employees are encouraged to ____ their ideas during the brainstorming session.",
      choices: ["contribute", "distribute", "attribute", "constitute"],
      answer: 0,
      explain: "“Contribute” means to give or add. You contribute ideas; distribute = hand out; attribute = credit.",
    },
    {
      q: "The presentation was so ____ that the audience asked many questions.",
      choices: ["informative", "informal", "informer", "informant"],
      answer: 0,
      explain: "“Informative” (adjective) means providing useful information — the right form to describe a presentation.",
    },
    {
      q: "We need to ____ our marketing strategy to reach younger customers.",
      choices: ["modify", "mortify", "notify", "ratify"],
      answer: 0,
      explain: "“Modify” means to change or adjust. Notify = inform, ratify = formally approve.",
    },
    {
      q: "The hotel is conveniently ____ near the airport and major highways.",
      choices: ["located", "allocated", "relocated", "dislocated"],
      answer: 0,
      explain: "“Located” means situated. The hotel is located near the airport.",
    },
    {
      q: "Sales figures ____ sharply in the final quarter of the year.",
      choices: ["increased", "incurred", "induced", "inclined"],
      answer: 0,
      explain: "“Increased” means went up. Sales figures increased sharply.",
    },
    {
      q: "All visitors must ____ at the front desk before entering the building.",
      choices: ["register", "regulate", "regret", "regard"],
      answer: 0,
      explain: "“Register” means to sign in / record your name — what visitors do at a front desk.",
    },
    {
      q: "The technician will ____ the equipment to ensure it works properly.",
      choices: ["inspect", "suspect", "respect", "expect"],
      answer: 0,
      explain: "“Inspect” means to examine carefully. A technician inspects equipment.",
    },
    {
      q: "Our profits have grown ____ over the past three years.",
      choices: ["steadily", "steady", "steadiness", "steadier"],
      answer: 0,
      explain: "An adverb is needed to modify the verb “grown.” “Steadily” is the adverb form.",
    },
    {
      q: "The company is committed to providing ____ customer service.",
      choices: ["exceptional", "exceptionally", "exception", "except"],
      answer: 0,
      explain: "An adjective is needed before the noun “service.” “Exceptional” is the adjective.",
    },
    {
      q: "Due to the bad weather, the flight was ____ for two hours.",
      choices: ["delayed", "decayed", "displayed", "deployed"],
      answer: 0,
      explain: "“Delayed” means made late. Flights are delayed by bad weather.",
    },
  ],

  /* ============================= GRAMMAR ============================= */
  grammar: [
    {
      q: "If the shipment ____ on time, we would have met the deadline.",
      choices: ["had arrived", "arrived", "has arrived", "arrives"],
      answer: 0,
      explain: "Third conditional: “If + past perfect (had arrived), … would have + past participle.”",
    },
    {
      q: "The report, along with the supporting documents, ____ on your desk.",
      choices: ["is", "are", "were", "have been"],
      answer: 0,
      explain: "The subject is “the report” (singular). Phrases with “along with” don't change the verb agreement.",
    },
    {
      q: "She has been working here ____ 2015.",
      choices: ["since", "for", "from", "during"],
      answer: 0,
      explain: "Use “since” with a point in time (2015) and “for” with a duration (five years).",
    },
    {
      q: "The manager asked the team to finish the project ____ Friday.",
      choices: ["by", "until", "since", "during"],
      answer: 0,
      explain: "“By Friday” means no later than Friday (a deadline). “Until” means up to that time continuously.",
    },
    {
      q: "Neither the director nor the employees ____ aware of the change.",
      choices: ["were", "was", "is", "has been"],
      answer: 0,
      explain: "With “neither…nor,” the verb agrees with the nearer subject — “employees” (plural) → “were.”",
    },
    {
      q: "The new software is much more efficient than ____ one.",
      choices: ["the previous", "previous", "a previous", "previously"],
      answer: 0,
      explain: "A specific, known item needs the definite article “the previous one.”",
    },
    {
      q: "We look forward to ____ from you soon.",
      choices: ["hearing", "hear", "heard", "be heard"],
      answer: 0,
      explain: "“Look forward to” is followed by a gerund (-ing): “hearing.”",
    },
    {
      q: "The documents ____ by the assistant before the meeting started.",
      choices: ["had been prepared", "had prepared", "have prepared", "has prepared"],
      answer: 0,
      explain: "Passive past perfect: the documents (object) “had been prepared” before another past event.",
    },
    {
      q: "____ the heavy traffic, she arrived at the office on time.",
      choices: ["Despite", "Although", "Because of", "However"],
      answer: 0,
      explain: "“Despite + noun phrase” shows contrast. “Although” needs a clause; “because of” shows cause.",
    },
    {
      q: "Every employee ____ required to attend the safety training.",
      choices: ["is", "are", "were", "have"],
      answer: 0,
      explain: "“Every + singular noun” takes a singular verb → “is.”",
    },
    {
      q: "The CEO, ____ company is based in Tokyo, will visit our office.",
      choices: ["whose", "who", "which", "whom"],
      answer: 0,
      explain: "“Whose” shows possession (the CEO's company).",
    },
    {
      q: "Our sales have increased ____ we launched the new campaign.",
      choices: ["since", "for", "during", "by"],
      answer: 0,
      explain: "“Since” introduces a time clause marking when something started.",
    },
    {
      q: "The proposal needs ____ before it can be submitted.",
      choices: ["revising", "to revising", "revise", "revised"],
      answer: 0,
      explain: "“Need + gerund” has a passive meaning: “needs revising” = needs to be revised.",
    },
    {
      q: "If you ____ any questions, please contact our support team.",
      choices: ["have", "had", "will have", "would have"],
      answer: 0,
      explain: "First conditional / general truth uses the present simple in the if-clause: “If you have.”",
    },
    {
      q: "The conference room is ____ than the one upstairs.",
      choices: ["more spacious", "spacious", "most spacious", "spaciously"],
      answer: 0,
      explain: "Comparative with a long adjective: “more spacious than.”",
    },
    {
      q: "He suggested ____ the deadline by one week.",
      choices: ["extending", "to extend", "extend", "extended"],
      answer: 0,
      explain: "“Suggest” is followed by a gerund: “suggested extending.”",
    },
  ],

  /* ============================= READING ============================= */
  reading: [
    {
      passage:
        "NOTICE TO ALL STAFF\n\nThe main parking lot will be closed for resurfacing from Monday, June 3 to Wednesday, June 5. During this period, employees may use the overflow lot on Maple Street at no charge. A free shuttle will run every 15 minutes between the overflow lot and the main entrance from 7:00 a.m. to 9:00 a.m. and from 5:00 p.m. to 7:00 p.m. We apologize for any inconvenience.",
      q: "Why will the main parking lot be closed?",
      choices: [
        "It is being resurfaced.",
        "It is being expanded.",
        "A new building is being constructed.",
        "It is reserved for visitors.",
      ],
      answer: 0,
      explain: "The notice states the lot will be closed “for resurfacing.”",
    },
    {
      passage:
        "NOTICE TO ALL STAFF\n\nThe main parking lot will be closed for resurfacing from Monday, June 3 to Wednesday, June 5. During this period, employees may use the overflow lot on Maple Street at no charge. A free shuttle will run every 15 minutes between the overflow lot and the main entrance from 7:00 a.m. to 9:00 a.m. and from 5:00 p.m. to 7:00 p.m.",
      q: "How often does the shuttle run during operating hours?",
      choices: ["Every 15 minutes", "Every 30 minutes", "Every hour", "Every 5 minutes"],
      answer: 0,
      explain: "The notice says the shuttle runs “every 15 minutes.”",
    },
    {
      passage:
        "From: Linda Chen\nTo: Marketing Team\nSubject: Quarterly Review Meeting\n\nHi everyone,\n\nOur quarterly review has been rescheduled to Thursday at 2:00 p.m. in Conference Room B. Please bring your campaign performance reports and be ready to present your results for no more than five minutes each. Lunch will not be provided, so please eat beforehand.\n\nThanks,\nLinda",
      q: "What are team members asked to bring?",
      choices: [
        "Their campaign performance reports",
        "Their laptops",
        "Lunch for the team",
        "A list of new clients",
      ],
      answer: 0,
      explain: "Linda asks the team to “bring your campaign performance reports.”",
    },
    {
      passage:
        "From: Linda Chen\nTo: Marketing Team\nSubject: Quarterly Review Meeting\n\nOur quarterly review has been rescheduled to Thursday at 2:00 p.m. in Conference Room B. Please be ready to present your results for no more than five minutes each. Lunch will not be provided, so please eat beforehand.",
      q: "What is implied about lunch?",
      choices: [
        "Employees should eat before the meeting.",
        "Lunch will be served in Room B.",
        "The meeting includes a catered lunch.",
        "Employees may order delivery.",
      ],
      answer: 0,
      explain: "“Lunch will not be provided, so please eat beforehand” implies employees should eat first.",
    },
    {
      passage:
        "Greenfield Fitness Center — Membership Update\n\nStarting July 1, all members will enjoy extended weekend hours. The center will now open at 6:00 a.m. and close at 10:00 p.m. on Saturdays and Sundays. In addition, two new yoga classes have been added to the Saturday schedule. Members can reserve a spot through our mobile app up to 48 hours in advance.",
      q: "What change takes effect on July 1?",
      choices: [
        "Weekend hours will be extended.",
        "Membership fees will increase.",
        "The center will close on Sundays.",
        "A new branch will open.",
      ],
      answer: 0,
      explain: "The update says members will “enjoy extended weekend hours” starting July 1.",
    },
    {
      passage:
        "Greenfield Fitness Center — Membership Update\n\nTwo new yoga classes have been added to the Saturday schedule. Members can reserve a spot through our mobile app up to 48 hours in advance.",
      q: "How can members reserve a spot in a yoga class?",
      choices: [
        "Through the mobile app",
        "By calling the front desk",
        "By emailing the instructor",
        "In person only",
      ],
      answer: 0,
      explain: "Members “can reserve a spot through our mobile app.”",
    },
    {
      passage:
        "Thank you for your recent purchase from BrightHome Appliances. Your order #48217 has shipped and is expected to arrive within 3 to 5 business days. If you are not completely satisfied, you may return the item within 30 days for a full refund. Please keep your receipt, as it is required for all returns.",
      q: "What is required to return an item?",
      choices: ["The receipt", "The original box", "A manager's approval", "A photo of the item"],
      answer: 0,
      explain: "“Please keep your receipt, as it is required for all returns.”",
    },
    {
      passage:
        "Thank you for your recent purchase from BrightHome Appliances. Your order #48217 has shipped and is expected to arrive within 3 to 5 business days. If you are not completely satisfied, you may return the item within 30 days for a full refund.",
      q: "Within how many days can a customer return the item?",
      choices: ["30 days", "5 days", "14 days", "60 days"],
      answer: 0,
      explain: "Customers “may return the item within 30 days for a full refund.”",
    },
    {
      passage:
        "JOB POSTING: Administrative Assistant\n\nWe are seeking a detail-oriented Administrative Assistant to support our busy downtown office. Responsibilities include scheduling meetings, managing correspondence, and maintaining office supplies. The ideal candidate has at least two years of experience and is proficient in spreadsheet software. To apply, send your résumé to careers@apexgroup.com by August 15.",
      q: "What is one requirement for the position?",
      choices: [
        "At least two years of experience",
        "A graduate degree",
        "Fluency in three languages",
        "Willingness to travel abroad",
      ],
      answer: 0,
      explain: "The ideal candidate “has at least two years of experience.”",
    },
    {
      passage:
        "JOB POSTING: Administrative Assistant\n\nResponsibilities include scheduling meetings, managing correspondence, and maintaining office supplies. To apply, send your résumé to careers@apexgroup.com by August 15.",
      q: "How should applicants apply?",
      choices: [
        "By emailing their résumé",
        "By visiting the office",
        "By calling the manager",
        "By filling out an online form",
      ],
      answer: 0,
      explain: "Applicants should “send your résumé to careers@apexgroup.com.”",
    },
    {
      passage:
        "Reminder: The annual software license for your accounting system will expire on September 30. To avoid any interruption in service, please renew before that date. Renewal can be completed online in just a few minutes. Customers who renew early will receive a 10% discount on next year's subscription.",
      q: "What benefit is offered to customers who renew early?",
      choices: [
        "A 10% discount",
        "A free upgrade",
        "An extra month of service",
        "Priority support",
      ],
      answer: 0,
      explain: "“Customers who renew early will receive a 10% discount.”",
    },
    {
      passage:
        "Welcome to the Riverside Conference Center. Wi-Fi is available throughout the building; the network name is “RCC-Guest” and no password is required. Restrooms are located on each floor near the elevators. In case of emergency, please use the stairwells, not the elevators, and gather at the assembly point in the north parking lot.",
      q: "Where should people gather in an emergency?",
      choices: [
        "The north parking lot",
        "The main lobby",
        "The nearest restroom",
        "The elevator area",
      ],
      answer: 0,
      explain: "“Gather at the assembly point in the north parking lot.”",
    },
  ],

  /* ============================ LISTENING ============================ */
  listening: [
    {
      audio: "The meeting has been moved to three o'clock this afternoon.",
      q: "What time is the meeting now?",
      choices: ["3:00 p.m.", "2:00 p.m.", "3:00 a.m.", "Tomorrow morning"],
      answer: 0,
      explain: "The speaker says the meeting was moved to “three o'clock this afternoon” — 3:00 p.m.",
    },
    {
      audio: "Could you please send me the report by the end of the day?",
      q: "What does the speaker ask for?",
      choices: [
        "The report by the end of the day",
        "A meeting tomorrow",
        "A phone call",
        "Help with the printer",
      ],
      answer: 0,
      explain: "The speaker asks the listener to “send me the report by the end of the day.”",
    },
    {
      audio: "The train to Boston departs from platform five in ten minutes.",
      q: "From which platform does the train depart?",
      choices: ["Platform five", "Platform nine", "Platform ten", "Platform two"],
      answer: 0,
      explain: "The announcement says the train departs “from platform five.”",
    },
    {
      audio: "I'm sorry, but the item you ordered is currently out of stock.",
      q: "What is the problem?",
      choices: [
        "The item is out of stock.",
        "The order was cancelled.",
        "The price increased.",
        "The address is wrong.",
      ],
      answer: 0,
      explain: "The speaker explains the item is “currently out of stock.”",
    },
    {
      audio: "Don't forget to bring your ID badge to enter the building tomorrow.",
      q: "What should the listener remember to bring?",
      choices: ["An ID badge", "A laptop", "A parking pass", "Lunch"],
      answer: 0,
      explain: "“Don't forget to bring your ID badge.”",
    },
    {
      audio: "The store will be closed on Monday for a public holiday.",
      q: "When will the store be closed?",
      choices: ["On Monday", "On Sunday", "All week", "On Friday"],
      answer: 0,
      explain: "“The store will be closed on Monday for a public holiday.”",
    },
    {
      audio: "Please turn off your mobile phones before the presentation begins.",
      q: "What are listeners asked to do?",
      choices: [
        "Turn off their phones",
        "Take their seats",
        "Sign in at the desk",
        "Submit their questions",
      ],
      answer: 0,
      explain: "“Please turn off your mobile phones before the presentation begins.”",
    },
    {
      audio: "Our flight has been delayed by approximately forty-five minutes.",
      q: "How long is the flight delayed?",
      choices: [
        "About 45 minutes",
        "About 15 minutes",
        "About 4 hours",
        "It is not delayed.",
      ],
      answer: 0,
      explain: "The flight is delayed “by approximately forty-five minutes.”",
    },
    {
      audio: "You can pick up your package at the front desk after two p.m.",
      q: "Where can the package be picked up?",
      choices: [
        "At the front desk",
        "At the post office",
        "In the parking lot",
        "At the warehouse",
      ],
      answer: 0,
      explain: "“You can pick up your package at the front desk.”",
    },
    {
      audio: "The workshop is full, but you can add your name to the waiting list.",
      q: "What can the listener do?",
      choices: [
        "Join the waiting list",
        "Get a full refund",
        "Attend a different city",
        "Reschedule for next year",
      ],
      answer: 0,
      explain: "“You can add your name to the waiting list.”",
    },
    {
      audio: "Remember to submit your timesheet before you leave on Friday.",
      q: "What must be submitted before Friday?",
      choices: ["A timesheet", "A vacation request", "An expense report", "A project plan"],
      answer: 0,
      explain: "“Remember to submit your timesheet before you leave on Friday.”",
    },
    {
      audio: "The elevator is out of service, so please use the stairs.",
      q: "Why should people use the stairs?",
      choices: [
        "The elevator is out of service.",
        "The stairs are faster.",
        "There is a fire drill.",
        "The elevator is reserved.",
      ],
      answer: 0,
      explain: "“The elevator is out of service, so please use the stairs.”",
    },
  ],
};

/* Mode metadata used by the UI (labels, icons, colours, descriptions). */
const MODE_META = {
  vocabulary: {
    label: "Vocabulary",
    th: "คำศัพท์",
    icon: "📚",
    desc: "Word choice & meaning — TOEIC Part 5 style.",
    accent: "#6366f1",
  },
  grammar: {
    label: "Grammar",
    th: "ไวยากรณ์",
    icon: "✏️",
    desc: "Fill in the blank with the correct form.",
    accent: "#ec4899",
  },
  reading: {
    label: "Reading",
    th: "การอ่าน",
    icon: "📰",
    desc: "Read a short passage, then answer.",
    accent: "#f59e0b",
  },
  listening: {
    label: "Listening",
    th: "การฟัง",
    icon: "🎧",
    desc: "Listen to the audio, then answer.",
    accent: "#10b981",
  },
};

// Expose to the global scope for app.js.
window.QUESTION_BANK = QUESTION_BANK;
window.MODE_META = MODE_META;
