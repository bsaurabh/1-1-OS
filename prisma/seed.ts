/**
 * Demo seed script
 * Creates a demo manager account with realistic mock data for demos.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json -e "require('ts-node').register({ transpileOnly: true })" prisma/seed.ts
 *   OR add to package.json: "db:seed": "ts-node --transpile-only prisma/seed.ts"
 *   then run: npm run db:seed
 *
 * Demo credentials:
 *   Email:    demo@example.com
 *   Password: Demo1234!
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEMO_EMAIL = 'demo@example.com'
const DEMO_PASSWORD = 'Demo1234!'
// Fixed ID so re-running seed is idempotent
const DEMO_MANAGER_ID = 'cm_demo_manager_0001'

const now = new Date()
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

async function main() {
  console.log('Seeding demo account...')

  // Hash password
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)

  // ── Manager ──────────────────────────────────────────────────────────────
  // Use upsert so re-running the script is safe
  const manager = await prisma.manager.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      id: DEMO_MANAGER_ID,
      email: DEMO_EMAIL,
      passwordHash,
    },
  })

  console.log(`Manager: ${manager.email} (${manager.id})`)

  // ── Teammates ─────────────────────────────────────────────────────────────
  const [alex, maya] = await Promise.all([
    prisma.teammate.upsert({
      where: { id: 'cm_demo_teammate_alex' },
      update: {
        profile: {
          strengths: 'Strong system design instincts, effective at mentoring junior engineers, excellent debugger under pressure.',
          growthAreas: 'Cross-team communication and written async updates. Tends to under-communicate status to stakeholders outside the team.',
          aspirations: 'Grow into a Staff Engineer role. Wants to own an architectural initiative end-to-end within the next 12 months.',
          kpis: 'Service reliability (p99 latency, error rate), code review turnaround, team velocity contribution.',
          behavioralTendencies: 'Methodical and thorough. Prefers long focused blocks over fragmented meetings. Can be reluctant to ask for help.',
          feedbackStyle: 'Prefers direct, specific feedback. Appreciates written summaries after verbal conversations.',
          motivationDrivers: 'Technical challenge, ownership over complex systems, and visible career progression.',
        },
      },
      create: {
        id: 'cm_demo_teammate_alex',
        managerId: manager.id,
        name: 'Alex Rivera',
        role: 'Senior Software Engineer',
        profile: {
          strengths: 'Strong system design instincts, effective at mentoring junior engineers, excellent debugger under pressure.',
          growthAreas: 'Cross-team communication and written async updates. Tends to under-communicate status to stakeholders outside the team.',
          aspirations: 'Grow into a Staff Engineer role. Wants to own an architectural initiative end-to-end within the next 12 months.',
          kpis: 'Service reliability (p99 latency, error rate), code review turnaround, team velocity contribution.',
          behavioralTendencies: 'Methodical and thorough. Prefers long focused blocks over fragmented meetings. Can be reluctant to ask for help.',
          feedbackStyle: 'Prefers direct, specific feedback. Appreciates written summaries after verbal conversations.',
          motivationDrivers: 'Technical challenge, ownership over complex systems, and visible career progression.',
        },
      },
    }),
    prisma.teammate.upsert({
      where: { id: 'cm_demo_teammate_maya' },
      update: {
        profile: {
          strengths: 'Exceptional at stakeholder alignment and roadmap clarity. Strong data analysis skills and sharp at synthesizing user research.',
          growthAreas: 'Setting boundaries on scope creep and improving async written communication — PRDs tend to be too verbose.',
          aspirations: 'Lead a full product area end-to-end, including owning the annual planning cycle.',
          kpis: 'Feature adoption rate, time-to-decision on roadmap items, NPS for shipped features.',
          behavioralTendencies: 'Collaborative and thrives in ambiguity. Sometimes over-prepares for meetings when a concise brief would suffice.',
          feedbackStyle: 'Appreciates candid feedback with concrete examples. Does well with positive reinforcement alongside coaching.',
          motivationDrivers: 'Customer impact, cross-functional relationships, and growing her team\'s capabilities.',
        },
      },
      create: {
        id: 'cm_demo_teammate_maya',
        managerId: manager.id,
        name: 'Maya Chen',
        role: 'Product Manager',
        profile: {
          strengths: 'Exceptional at stakeholder alignment and roadmap clarity. Strong data analysis skills and sharp at synthesizing user research.',
          growthAreas: 'Setting boundaries on scope creep and improving async written communication — PRDs tend to be too verbose.',
          aspirations: 'Lead a full product area end-to-end, including owning the annual planning cycle.',
          kpis: 'Feature adoption rate, time-to-decision on roadmap items, NPS for shipped features.',
          behavioralTendencies: 'Collaborative and thrives in ambiguity. Sometimes over-prepares for meetings when a concise brief would suffice.',
          feedbackStyle: 'Appreciates candid feedback with concrete examples. Does well with positive reinforcement alongside coaching.',
          motivationDrivers: 'Customer impact, cross-functional relationships, and growing her team\'s capabilities.',
        },
      },
    }),
  ])

  console.log(`Teammates: ${alex.name}, ${maya.name}`)

  // ── Meetings ──────────────────────────────────────────────────────────────
  // Alex — 3 meetings
  const alexMeeting1 = await prisma.meeting.upsert({
    where: { id: 'cm_demo_meeting_a1' },
    update: {},
    create: {
      id: 'cm_demo_meeting_a1',
      managerId: manager.id,
      teammateId: alex.id,
      source: 'PASTE',
      status: 'ANALYSIS_COMPLETE',
      rawText: `Manager: How's the refactor going?
Alex: Making good progress. Got the service layer separated out. The tests are green.
Manager: Great. Any blockers?
Alex: Not really. I do want to pair with Jamie on the auth piece since it's tricky. Hard to find overlap time though.
Manager: Let's block some time this week. How are you feeling about the Q3 timeline?
Alex: I think we'll hit it, but if the auth work surfaces surprises we might slip a week.
Manager: Good to know early. Anything else on your mind?
Alex: I've been thinking about the staff eng path. I'd like to understand what that would look like here.
Manager: Let's make that a recurring topic. I'll put together some notes on what we look for.`,
      themes: ['technical progress', 'cross-team collaboration', 'career growth', 'timeline risk'],
      tags: ['refactor', 'career', 'planning', 'collaboration'],
      summary:
        'Alex is on track with the service-layer refactor and tests are passing. Key blocker is scheduling overlap time with Jamie for the auth piece. Q3 timeline is likely achievable with a small buffer. Alex raised interest in the staff engineer track — agreed to make it a recurring discussion.',
      tone: 'productive',
      createdAt: daysAgo(28),
      updatedAt: daysAgo(28),
    },
  })

  const alexMeeting2 = await prisma.meeting.upsert({
    where: { id: 'cm_demo_meeting_a2' },
    update: {},
    create: {
      id: 'cm_demo_meeting_a2',
      managerId: manager.id,
      teammateId: alex.id,
      source: 'PASTE',
      status: 'ANALYSIS_COMPLETE',
      rawText: `Manager: Quick check-in — how did the auth pair session go?
Alex: It went well. Jamie and I knocked it out in an afternoon. Turns out the complexity was overestimated.
Manager: Nice. How's overall energy this week?
Alex: Honestly, a little drained. I've been in a lot of cross-team sync meetings that feel low-value.
Manager: Which ones specifically?
Alex: The platform alignment call. It's an hour every week and usually resolves in Slack anyway.
Manager: I'll look into cutting or reducing it. You shouldn't have that overhead.
Alex: I'd appreciate that. Otherwise things are good. I shipped the config refactor ahead of schedule.
Manager: That's great work. On the staff eng discussion — I've drafted what we look for. Want to review together?
Alex: Definitely.`,
      themes: ['delivery', 'meeting overhead', 'morale', 'staff eng discussion'],
      tags: ['delivery', 'morale', 'process', 'career'],
      summary:
        'Auth work completed ahead of schedule after pair session with Jamie. Alex flagged burnout from low-value cross-team meetings, specifically the weekly platform alignment call. Agreed to review and reduce meeting load. Config refactor shipped early. Began reviewing staff engineer expectations document.',
      tone: 'collaborative',
      createdAt: daysAgo(14),
      updatedAt: daysAgo(14),
    },
  })

  const alexMeeting3 = await prisma.meeting.upsert({
    where: { id: 'cm_demo_meeting_a3' },
    update: {},
    create: {
      id: 'cm_demo_meeting_a3',
      managerId: manager.id,
      teammateId: alex.id,
      source: 'PASTE',
      status: 'ANALYSIS_COMPLETE',
      rawText: `Manager: How are you doing? Last couple weeks looked intense.
Alex: Yeah, the on-call rotation hit at a bad time with the migration happening simultaneously.
Manager: Were you able to get help from the team?
Alex: Mostly handled it solo. I don't love asking for help — feels like I should be able to manage it.
Manager: I want to push back on that a bit. Delegation is a key part of the senior level. Owning it solo isn't always the right call.
Alex: Fair point. I'll try to loop in Priya earlier next time.
Manager: Good. On the migration — it shipped cleanly, right?
Alex: Yes, zero downtime. Pretty proud of that.
Manager: You should be. That was a complex one. Anything you'd do differently?
Alex: Start the comms earlier. We were sending status updates the day of rather than a week out.
Manager: Let's document that for the retro. And I want to flag — I've recommended you for the staff eng panel discussion next quarter.
Alex: Wow, thank you. That means a lot.`,
      themes: ['on-call burden', 'delegation patterns', 'successful migration', 'staff eng progression'],
      tags: ['on-call', 'delegation', 'delivery', 'career'],
      summary:
        'Alex handled a challenging overlap of on-call and migration work, mostly solo due to reluctance to delegate. Migration shipped with zero downtime — strong outcome. Discussed delegation as a key growth area for staff eng. Alex committed to looping in teammates earlier. Manager nominated Alex for staff eng panel next quarter.',
      tone: 'productive',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  })

  // Maya — 3 meetings
  const mayaMeeting1 = await prisma.meeting.upsert({
    where: { id: 'cm_demo_meeting_m1' },
    update: {},
    create: {
      id: 'cm_demo_meeting_m1',
      managerId: manager.id,
      teammateId: maya.id,
      source: 'PASTE',
      status: 'ANALYSIS_COMPLETE',
      rawText: `Manager: How's the Q3 roadmap shaping up?
Maya: We're mostly set. The three main bets are locked. I'm getting push from the growth team to add a fourth.
Manager: What's your gut on it?
Maya: Honestly I think it's too much. But I find it hard to say no when they frame it as a revenue opportunity.
Manager: That's a pattern worth addressing. What does the data say?
Maya: The data is weak. It's more intuition on their side.
Manager: Then you have a solid reason to push back. Want to workshop the conversation?
Maya: Yes, that would help a lot.
Manager: Let's do that. Separate topic — how are the new APMs feeling about the process changes?
Maya: Mixed. Priya is adjusting well. Marcus is struggling with the async-first expectation.
Manager: Is that a skill gap or a culture fit?
Maya: Skill gap I think. He's used to more real-time collaboration.
Manager: Let's create some structure for him. I'll draft an async communication guide if you can share what's not clicking.`,
      themes: ['roadmap scope management', 'saying no to stakeholders', 'team development'],
      tags: ['roadmap', 'stakeholders', 'team', 'process'],
      summary:
        'Q3 roadmap is largely set with three bets confirmed. Growth team is pressuring Maya to add a fourth despite weak data. Maya acknowledged difficulty saying no — agreed to workshop the conversation. APM team has mixed adoption of async-first practices; Marcus needs structured support. Will co-create async comms guide.',
      tone: 'collaborative',
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
  })

  const mayaMeeting2 = await prisma.meeting.upsert({
    where: { id: 'cm_demo_meeting_m2' },
    update: {},
    create: {
      id: 'cm_demo_meeting_m2',
      managerId: manager.id,
      teammateId: maya.id,
      source: 'PASTE',
      status: 'ANALYSIS_COMPLETE',
      rawText: `Manager: Did the growth conversation happen?
Maya: It did. I pushed back and they actually accepted it. I was surprised how receptive they were.
Manager: That's great. What worked?
Maya: I framed it around focus and quality of the existing bets. They care about those succeeding.
Manager: Good instinct. That's stakeholder alignment, not just saying no.
Maya: Yeah, it felt different once I reframed it.
Manager: How did the PRD reviews go this week?
Maya: Long. I got feedback that my PRDs are too verbose. That they bury the lede.
Manager: What do you think?
Maya: Probably true. I over-index on being thorough. I'll try a one-pager format next cycle.
Manager: I think that's the right call. Also — Marcus. Did the async guide help?
Maya: Partially. He's writing more but the quality of async updates is low. Lots of status updates, not enough context or decisions.
Manager: Let's do a specific example together with him. Show vs tell.`,
      themes: ['stakeholder influence', 'written communication clarity', 'team coaching'],
      tags: ['stakeholders', 'communication', 'team', 'coaching'],
      summary:
        'Maya successfully pushed back on growth team scope addition using an impact-framing approach. PRD length feedback received — will try concise one-pager format. Marcus showing progress on async communication but quality needs improvement. Planned a concrete show-don\'t-tell coaching session with Marcus.',
      tone: 'productive',
      createdAt: daysAgo(16),
      updatedAt: daysAgo(16),
    },
  })

  const mayaMeeting3 = await prisma.meeting.upsert({
    where: { id: 'cm_demo_meeting_m3' },
    update: {},
    create: {
      id: 'cm_demo_meeting_m3',
      managerId: manager.id,
      teammateId: maya.id,
      source: 'PASTE',
      status: 'ANALYSIS_COMPLETE',
      rawText: `Manager: Big week — the feature shipped. How are you feeling?
Maya: Relieved and excited. Customer feedback is coming in and it's mostly positive.
Manager: What went well in the launch?
Maya: Cross-functional alignment. We had everyone on the same page a week before. No last-minute surprises.
Manager: What would you do differently?
Maya: We underestimated the support ticket volume. We should have drafted FAQs and trained support earlier.
Manager: Good learning. That's worth capturing in your launch playbook.
Maya: Already started it.
Manager: Great proactivity. On the team side — any updates on Marcus?
Maya: He's really coming around. His last async update was clear and decision-oriented. Big improvement.
Manager: That's great progress. Credit to your coaching.
Maya: He did the work. I just created the structure.
Manager: That self-awareness is what distinguishes strong PMs. One thing I want to flag: I'd like to see you take on the Q4 planning lead. You're ready for the full scope.
Maya: That's a big responsibility. I'm nervous but excited.
Manager: That's the right response. Let's start planning your onboarding to it.`,
      themes: ['successful launch', 'launch playbook', 'team growth', 'increased scope'],
      tags: ['launch', 'planning', 'team', 'growth'],
      summary:
        'Major feature launched successfully with strong cross-functional alignment. Key learning: support team prep needs to happen earlier. Maya proactively started a launch playbook. Marcus has meaningfully improved async communication quality. Manager offered Maya the Q4 planning lead — she accepted with excitement and appropriate nerves.',
      tone: 'collaborative',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
  })

  console.log('Meetings created: 3 for Alex, 3 for Maya')

  // ── Patterns ──────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.pattern.upsert({
      where: { id: 'cm_demo_pattern_a1' },
      update: {},
      create: {
        id: 'cm_demo_pattern_a1',
        teammateId: alex.id,
        severity: 'WATCH',
        description:
          'Alex consistently avoids asking for help or delegating, preferring to handle complex work solo. This creates burnout risk and limits throughput.',
        evidence: {
          meetingIds: [alexMeeting2.id, alexMeeting3.id],
          dates: [daysAgo(14).toLocaleDateString(), daysAgo(1).toLocaleDateString()],
          tags: ['on-call', 'delegation', 'morale'],
        },
        detectedAt: daysAgo(1),
      },
    }),
    prisma.pattern.upsert({
      where: { id: 'cm_demo_pattern_a2' },
      update: {},
      create: {
        id: 'cm_demo_pattern_a2',
        teammateId: alex.id,
        severity: 'INFORMATIONAL',
        description:
          'Alex consistently ships ahead of schedule when working in focused mode without heavy meeting overhead. Energy and output drop when meeting load increases.',
        evidence: {
          meetingIds: [alexMeeting1.id, alexMeeting2.id],
          dates: [daysAgo(28).toLocaleDateString(), daysAgo(14).toLocaleDateString()],
          tags: ['delivery', 'morale', 'process'],
        },
        detectedAt: daysAgo(14),
      },
    }),
    prisma.pattern.upsert({
      where: { id: 'cm_demo_pattern_m1' },
      update: {},
      create: {
        id: 'cm_demo_pattern_m1',
        teammateId: maya.id,
        severity: 'INFORMATIONAL',
        description:
          'Maya has shown consistent growth in stakeholder boundary-setting over the past month, moving from difficulty saying no to framing pushback constructively.',
        evidence: {
          meetingIds: [mayaMeeting1.id, mayaMeeting2.id],
          dates: [daysAgo(30).toLocaleDateString(), daysAgo(16).toLocaleDateString()],
          tags: ['stakeholders', 'communication'],
        },
        detectedAt: daysAgo(16),
      },
    }),
    prisma.pattern.upsert({
      where: { id: 'cm_demo_pattern_m2' },
      update: {},
      create: {
        id: 'cm_demo_pattern_m2',
        teammateId: maya.id,
        severity: 'WATCH',
        description:
          'Maya\'s written deliverables (PRDs, updates) tend to prioritize completeness over clarity. Feedback from stakeholders indicates the core message gets buried.',
        evidence: {
          meetingIds: [mayaMeeting2.id],
          dates: [daysAgo(16).toLocaleDateString()],
          tags: ['communication'],
        },
        detectedAt: daysAgo(16),
      },
    }),
  ])

  console.log('Patterns created: 2 for Alex, 2 for Maya')

  // ── Commitments ───────────────────────────────────────────────────────────
  await Promise.all([
    // Alex commitments
    prisma.commitment.upsert({
      where: { id: 'cm_demo_commit_a1' },
      update: {},
      create: {
        id: 'cm_demo_commit_a1',
        managerId: manager.id,
        teammateId: alex.id,
        meetingId: alexMeeting1.id,
        text: 'Block time with Jamie this week to pair on the auth piece',
        owner: 'MANAGER',
        status: 'DONE',
        dueDate: daysAgo(21),
        carryCount: 0,
        createdAt: daysAgo(28),
        updatedAt: daysAgo(21),
      },
    }),
    prisma.commitment.upsert({
      where: { id: 'cm_demo_commit_a2' },
      update: {},
      create: {
        id: 'cm_demo_commit_a2',
        managerId: manager.id,
        teammateId: alex.id,
        meetingId: alexMeeting1.id,
        text: 'Put together notes on staff engineer expectations for Alex to review',
        owner: 'MANAGER',
        status: 'DONE',
        dueDate: daysAgo(7),
        carryCount: 0,
        createdAt: daysAgo(28),
        updatedAt: daysAgo(7),
      },
    }),
    prisma.commitment.upsert({
      where: { id: 'cm_demo_commit_a3' },
      update: {},
      create: {
        id: 'cm_demo_commit_a3',
        managerId: manager.id,
        teammateId: alex.id,
        meetingId: alexMeeting2.id,
        text: 'Audit and reduce low-value cross-team syncs (starting with platform alignment call)',
        owner: 'MANAGER',
        status: 'OPEN',
        dueDate: daysAgo(7),
        carryCount: 1,
        createdAt: daysAgo(14),
        updatedAt: daysAgo(1),
      },
    }),
    prisma.commitment.upsert({
      where: { id: 'cm_demo_commit_a4' },
      update: {},
      create: {
        id: 'cm_demo_commit_a4',
        managerId: manager.id,
        teammateId: alex.id,
        meetingId: alexMeeting3.id,
        text: 'Loop in Priya earlier when on-call conflicts with major project work',
        owner: 'TEAMMATE',
        status: 'OPEN',
        dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        carryCount: 0,
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
      },
    }),
    // Maya commitments
    prisma.commitment.upsert({
      where: { id: 'cm_demo_commit_m1' },
      update: {},
      create: {
        id: 'cm_demo_commit_m1',
        managerId: manager.id,
        teammateId: maya.id,
        meetingId: mayaMeeting1.id,
        text: 'Workshop pushback conversation with growth team before next sync',
        owner: 'MANAGER',
        status: 'DONE',
        dueDate: daysAgo(23),
        carryCount: 0,
        createdAt: daysAgo(30),
        updatedAt: daysAgo(23),
      },
    }),
    prisma.commitment.upsert({
      where: { id: 'cm_demo_commit_m2' },
      update: {},
      create: {
        id: 'cm_demo_commit_m2',
        managerId: manager.id,
        teammateId: maya.id,
        meetingId: mayaMeeting2.id,
        text: 'Try one-pager PRD format for next feature spec',
        owner: 'TEAMMATE',
        status: 'DONE',
        dueDate: daysAgo(9),
        carryCount: 0,
        createdAt: daysAgo(16),
        updatedAt: daysAgo(9),
      },
    }),
    prisma.commitment.upsert({
      where: { id: 'cm_demo_commit_m3' },
      update: {},
      create: {
        id: 'cm_demo_commit_m3',
        managerId: manager.id,
        teammateId: maya.id,
        meetingId: mayaMeeting3.id,
        text: 'Start onboarding Maya to Q4 planning lead role — share context docs and intros',
        owner: 'MANAGER',
        status: 'OPEN',
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        carryCount: 0,
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
      },
    }),
    prisma.commitment.upsert({
      where: { id: 'cm_demo_commit_m4' },
      update: {},
      create: {
        id: 'cm_demo_commit_m4',
        managerId: manager.id,
        teammateId: maya.id,
        meetingId: mayaMeeting3.id,
        text: 'Finalize and share launch playbook template based on Q3 retro learnings',
        owner: 'TEAMMATE',
        status: 'OPEN',
        dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        carryCount: 0,
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
      },
    }),
  ])

  console.log('Commitments created: 4 for Alex, 4 for Maya')

  // ── Excel Analyses ────────────────────────────────────────────────────────
  await Promise.all([
    prisma.excelAnalysis.upsert({
      where: { id: 'cm_demo_excel_q1_2026' },
      update: {},
      create: {
        id: 'cm_demo_excel_q1_2026',
        managerId: manager.id,
        filename: 'Q1 2026 Design Delivery Tracker.xlsx',
        sheetName: '2026 Tracker',
        rowCount: 24,
        schemaMapping: {
          itemName: 'Feature Name',
          status: 'Status',
          size: 'Size',
          createdDate: 'Start Date',
          completedDate: 'Ship Date',
          revenueImpact: 'Revenue Impact',
        },
        metrics: {
          delivery: {
            totalItems: 24,
            byStatus: { Completed: 14, 'In Progress': 6, Planned: 4 },
            bySize: { S: 8, M: 10, L: 6 },
            completionRate: 70,
          },
          time: {
            avgTurnaroundDays: 18,
            avgTurnaroundBySize: { S: 9, M: 18, L: 31 },
            itemsWithDelays: 3,
          },
          business: {
            totalRevenue: 285000,
            revenueByMonth: [
              { month: '2026-01', revenue: 72000 },
              { month: '2026-02', revenue: 118000 },
              { month: '2026-03', revenue: 95000 },
            ],
            revenuePerItem: 20357,
          },
          throughput: {
            completedByMonth: { '2026-01': 4, '2026-02': 6, '2026-03': 4 },
            velocityTrend: 'improving',
          },
          quality: { available: false },
        },
        insights: [
          'Completion rate of 70% is strong for Q1 — 14 of 20 items with a known status shipped on time.',
          'Large items (L) average 31 days to ship, 3.4× longer than small items. Consider breaking L items into smaller deliverables earlier in the quarter.',
          '3 items exceeded the expected turnaround by more than 50% — all were L-sized items with cross-team dependencies.',
          'February was the highest-velocity month with 6 completions and $118K revenue impact — likely benefiting from Q1 mid-sprint momentum.',
          'Revenue per shipped item averages $20K, with the top 3 items accounting for 58% of total revenue impact.',
          '6 items are still in progress heading into Q2 — prioritise the 2 L-sized items to avoid carry-forward.',
        ],
        recommendations: [
          'Add a "blocked by" column to your tracker to surface cross-team dependencies earlier.',
          'Set a size threshold: items scoped as L should include a breakdown into sub-tasks before sprint start.',
          'Consider adding a "Target Ship Date" column to make delay detection automatic rather than manual.',
        ],
        status: 'COMPLETE',
        analysedAt: daysAgo(2),
      },
    }),
    prisma.excelAnalysis.upsert({
      where: { id: 'cm_demo_excel_2025_annual' },
      update: {},
      create: {
        id: 'cm_demo_excel_2025_annual',
        managerId: manager.id,
        filename: '2025 Annual Design Tracker.xlsx',
        sheetName: 'All Items',
        rowCount: 48,
        schemaMapping: {
          itemName: 'Initiative',
          status: 'Stage',
          size: 'T-Shirt Size',
          createdDate: 'Kick-off',
          completedDate: 'Launched',
          revenueImpact: 'ARR Impact',
        },
        metrics: {
          delivery: {
            totalItems: 48,
            byStatus: { Completed: 38, 'In Progress': 6, Planned: 4 },
            completionRate: 79,
            bySize: { S: 14, M: 20, L: 14 },
          },
          time: {
            avgTurnaroundDays: 24,
            avgTurnaroundBySize: { S: 11, M: 22, L: 42 },
            itemsWithDelays: 7,
          },
          business: {
            totalRevenue: 1240000,
            revenueByMonth: [
              { month: '2025-01', revenue: 68000 },
              { month: '2025-02', revenue: 94000 },
              { month: '2025-03', revenue: 110000 },
              { month: '2025-04', revenue: 88000 },
              { month: '2025-05', revenue: 132000 },
              { month: '2025-06', revenue: 145000 },
              { month: '2025-07', revenue: 98000 },
              { month: '2025-08', revenue: 115000 },
              { month: '2025-09', revenue: 128000 },
              { month: '2025-10', revenue: 102000 },
              { month: '2025-11', revenue: 118000 },
              { month: '2025-12', revenue: 42000 },
            ],
            revenuePerItem: 32632,
          },
          throughput: {
            completedByMonth: {
              '2025-01': 2, '2025-02': 3, '2025-03': 4,
              '2025-04': 3, '2025-05': 5, '2025-06': 5,
              '2025-07': 3, '2025-08': 4, '2025-09': 4,
              '2025-10': 3, '2025-11': 2, '2025-12': 0,
            },
            velocityTrend: 'stable',
          },
          quality: { available: false },
        },
        insights: [
          '79% annual completion rate across 48 initiatives — strong execution for a team of this scale.',
          'Q2 (May–June) was the peak delivery window with 10 completions and $277K revenue impact, likely driven by H1 planning commitments.',
          'Q4 velocity dropped significantly: only 5 completions in Oct–Dec vs. 12 in Q3. Likely a combination of holiday slowdown and end-of-year planning overhead.',
          'Large items averaged 42 days — nearly 4× longer than small items. 7 of the 48 items missed their target by more than 2 weeks, all L or M sized.',
          'The top 5 revenue-generating initiatives contributed 41% of total ARR impact ($510K). These were all M-sized items, suggesting the sweet spot for high-impact delivery.',
          '6 items are still in progress entering 2026 — these should be the first candidates for Q1 sprint planning.',
        ],
        recommendations: [
          'Cap L-sized items to 2 per sprint. Historical data shows L items are the primary source of delays and carry-forwards.',
          'Introduce a mid-quarter checkpoint (week 6) to re-forecast completion likelihood for any in-progress L items.',
          'Revenue impact data is missing for 11 items — adding ARR estimates at scoping time would improve planning accuracy.',
          'Consider splitting the tracker by team or squad to surface individual throughput patterns.',
        ],
        status: 'COMPLETE',
        analysedAt: daysAgo(18),
      },
    }),
  ])

  console.log('Excel analyses created: Q1 2026 tracker, 2025 annual tracker')

  // ── Design Critiques ──────────────────────────────────────────────────────
  await Promise.all([
    prisma.designCritique.upsert({
      where: { id: 'cm_demo_critique_01' },
      update: {},
      create: {
        id: 'cm_demo_critique_01',
        managerId: manager.id,
        status: 'COMPLETE',
        featureName: 'Onboarding Flow Redesign',
        userType: 'First-time users signing up for a B2B SaaS product',
        featureGoal: 'Reduce time-to-value for new users by guiding them to their first meaningful action within 5 minutes of sign-up',
        successMetric: 'Activation rate (users completing setup) > 60% within first session',
        constraints: 'Must work within existing component library. No new onboarding service — must use current auth + profile APIs.',
        stage: 'EXPLORATORY',
        focusAreas: ['User flow clarity', 'Information hierarchy', 'Empty states', 'Progress indication'],
        imageUrls: [],
        figmaUrl: null,
        result: {
          executiveSummary: {
            clarityScore: 62,
            primaryRisk: 'Users are dropped into a blank dashboard with no guidance after sign-up — the most critical drop-off point.',
            primaryOpportunity: 'A focused 3-step setup wizard with progress indication could close the activation gap without requiring new backend work.',
          },
          criticalIssues: [
            {
              category: 'CRITICAL',
              title: 'No empty state on dashboard',
              description: 'After completing sign-up, users land on a blank dashboard with no explanation of what to do next. There is no empty state, no call-to-action, and no contextual help.',
              userImpact: 'Users don\'t know where to start, leading to immediate drop-off. This is the primary activation failure point.',
              suggestedFix: 'Add a persistent empty state with a single clear CTA ("Add your first teammate") and a brief explanation of what the app does for them.',
              location: null,
            },
            {
              category: 'CRITICAL',
              title: 'Progress not communicated during multi-step setup',
              description: 'The setup flow has 4 steps but shows no progress indicator. Users don\'t know how long the process takes, which increases abandonment.',
              userImpact: 'Users who abandon mid-flow are unlikely to return. Estimated 30–40% drop-off at step 2 based on comparable patterns.',
              suggestedFix: 'Add a step indicator (e.g. "Step 2 of 4") and estimated time to complete ("About 3 minutes") at the top of each step.',
              location: null,
            },
          ],
          uxImprovements: [
            {
              category: 'UX_IMPROVEMENT',
              title: 'Role selection uses a text input instead of a picker',
              description: 'The "Your role" field is a free-text input, leading to inconsistent entries and missed personalization opportunities.',
              userImpact: 'Personalization downstream (email tone, feature recommendations) will be less accurate, reducing perceived value.',
              suggestedFix: 'Replace with a segmented picker: Engineering Manager, Product Manager, Design Manager, Other.',
              location: null,
            },
            {
              category: 'UX_IMPROVEMENT',
              title: 'Team invite step is too early in the flow',
              description: 'Asking users to invite teammates before they\'ve experienced any value creates friction and low-quality invites.',
              userImpact: 'Users who haven\'t seen the product value are less likely to invite and less likely to have teammates accept.',
              suggestedFix: 'Move team invite to post-activation — after the user completes their first 1:1 or adds a teammate profile.',
              location: null,
            },
          ],
          visualCraftFeedback: [
            {
              category: 'VISUAL_CRAFT',
              title: 'Illustration style inconsistent with product UI',
              description: 'The onboarding illustrations use a hand-drawn style that clashes with the clean, data-dense product UI.',
              userImpact: 'Creates a perception gap — users expect the product to feel different from what they see after onboarding.',
              suggestedFix: 'Align illustration style with the product\'s indigo/gray palette and geometric aesthetic, or use icon-based visuals instead.',
              location: null,
            },
          ],
          accessibilityIssues: [
            {
              category: 'ACCESSIBILITY',
              title: 'CTA button contrast ratio below WCAG AA',
              description: 'The ghost/outline CTA button ("Skip for now") uses gray text on white background — contrast ratio is approximately 2.8:1, below the 4.5:1 requirement.',
              userImpact: 'Low-vision users may not be able to read the skip option, forcing them through the full flow unintentionally.',
              suggestedFix: 'Use at minimum #767676 on white for text buttons, or switch to a text link styled with an underline.',
              location: null,
            },
          ],
          productThinking: [
            {
              category: 'PRODUCT_THINKING',
              title: 'Success metric not reflected in the flow design',
              description: 'The stated goal is activation within the first session, but the flow doesn\'t define what "activated" means for the user or celebrate when they reach it.',
              userImpact: 'Users don\'t know when they\'ve succeeded, reducing the dopamine moment that drives retention.',
              suggestedFix: 'Define the activation event (e.g., first meeting pasted) and add a confirmation state: "You\'re set up! Here\'s what you can do now."',
              location: null,
            },
          ],
          missedOpportunities: [
            'Social proof (e.g., "Join 200+ managers using 1:1OS") could reduce hesitation during sign-up without engineering changes.',
            'A short product tour video or GIF in the empty state could dramatically reduce time-to-value perception.',
            'Progressive disclosure: show only the first step of setup, reveal subsequent steps only after the previous is complete.',
          ],
          questionsForDesigner: [
            'What is the current measured drop-off rate at each step of sign-up?',
            'Has the team considered a "guided first 1:1" flow where the product walks the user through adding their first teammate?',
            'Is there analytics on which roles users self-identify with most? That could inform the role picker ordering.',
          ],
          coachingInsight: 'The strongest designs at this stage solve for one thing: getting users to the first "aha" moment as fast as possible. Right now the flow is optimised for completeness (collecting all the data) rather than speed-to-value. Consider which fields you can defer to later and what the minimum viable onboarding looks like.',
        },
        createdAt: daysAgo(10),
        updatedAt: daysAgo(10),
      },
    }),
    prisma.designCritique.upsert({
      where: { id: 'cm_demo_critique_02' },
      update: {},
      create: {
        id: 'cm_demo_critique_02',
        managerId: manager.id,
        status: 'COMPLETE',
        featureName: 'Meeting Notes Input Modal',
        userType: 'Managers who want to quickly log a 1:1 meeting after it happens',
        featureGoal: 'Make it as fast as possible to paste or upload meeting notes so the AI can surface insights',
        successMetric: 'Time from modal open to submission under 45 seconds for paste flow; upload under 90 seconds',
        constraints: null,
        stage: 'FINAL_POLISH',
        focusAreas: ['Interaction speed', 'Visual polish', 'Error handling', 'Mobile readiness'],
        imageUrls: [],
        figmaUrl: null,
        result: {
          executiveSummary: {
            clarityScore: 81,
            primaryRisk: 'The upload tab has no file validation feedback — users don\'t know if their file was accepted until after submission.',
            primaryOpportunity: 'Minor polish pass on the paste tab (character count, auto-resize) would make the most-used path feel premium.',
          },
          criticalIssues: [
            {
              category: 'CRITICAL',
              title: 'No file validation feedback on upload tab',
              description: 'When a user drops an unsupported file type, the UI shows no error state. The drop zone simply resets silently.',
              userImpact: 'Users re-upload the same invalid file multiple times before realising the format isn\'t supported.',
              suggestedFix: 'Show an inline error with the accepted formats immediately on drop. Accepted formats should also be visible before the user attempts to upload.',
              location: null,
            },
          ],
          uxImprovements: [
            {
              category: 'UX_IMPROVEMENT',
              title: 'Textarea does not auto-resize',
              description: 'The paste textarea is fixed height. Long transcripts require scrolling within the field, making it hard to review content before submitting.',
              userImpact: 'Managers pasting long meeting notes can\'t see what they\'ve pasted, reducing confidence in the submission.',
              suggestedFix: 'Auto-expand the textarea up to a max height (e.g., 60vh), then scroll. This is a one-line CSS change with a small JS hook.',
              location: null,
            },
            {
              category: 'UX_IMPROVEMENT',
              title: 'No character count or word count indicator',
              description: 'Users don\'t know if they\'ve pasted enough content for meaningful AI analysis.',
              userImpact: 'Users may submit 2-sentence notes and be confused when insights are shallow.',
              suggestedFix: 'Show a live word count with a soft minimum guidance: "Tip: at least 100 words produces better insights." Turn it green when threshold is met.',
              location: null,
            },
          ],
          visualCraftFeedback: [
            {
              category: 'VISUAL_CRAFT',
              title: 'Tab underline animation is too slow',
              description: 'The active tab indicator slides at ~300ms which feels sluggish compared to the rest of the interaction model.',
              userImpact: 'Minor — creates a slight perception of lag when switching between Paste and Upload tabs.',
              suggestedFix: 'Reduce animation duration to 150ms with an ease-out curve.',
              location: null,
            },
            {
              category: 'VISUAL_CRAFT',
              title: 'Submit button copy is too generic',
              description: '"Submit" doesn\'t communicate what happens next. Users don\'t know if they\'ll see results immediately.',
              userImpact: 'Creates micro-uncertainty that slightly reduces submission confidence.',
              suggestedFix: 'Change to "Analyse meeting" or "Save & analyse" to set expectations.',
              location: null,
            },
          ],
          accessibilityIssues: [],
          productThinking: [
            {
              category: 'PRODUCT_THINKING',
              title: 'No confirmation that analysis is in progress',
              description: 'After submission the modal closes and the user returns to the profile page with no indication that analysis is running.',
              userImpact: 'Users don\'t know if submission worked. Some will re-open the modal and submit again.',
              suggestedFix: 'Show a transient toast or an "Analysing…" banner on the profile page that resolves when results are ready.',
              location: null,
            },
          ],
          missedOpportunities: [
            'A "Recent meetings" quick-fill for teammates the manager meets with regularly could reduce setup time by 20–30 seconds.',
            'Keyboard shortcut (⌘↵) to submit would make power users significantly faster.',
          ],
          questionsForDesigner: [
            'What is the current measured time from modal open to submission in the paste flow?',
            'Is there data on what percentage of users switch from paste to upload (or vice versa) before submitting?',
          ],
          coachingInsight: 'This design is close to production-ready — the core interaction is sound. At the final polish stage, focus on the micro-moments: does every transition feel intentional? Does every state communicate what just happened and what comes next? The gap between "good" and "great" at this stage is almost always copy and motion design.',
        },
        createdAt: daysAgo(4),
        updatedAt: daysAgo(4),
      },
    }),
  ])

  console.log('Design critiques created: Onboarding Flow, Meeting Notes Modal')

  console.log('\nDemo account ready!')
  console.log('  Email:    demo@example.com')
  console.log('  Password: Demo1234!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
