import { Step } from './types';

export const DEMO_TASKS: { input: string; steps: Step[] }[] = [
  {
    input: "Chase O'Brien & Co about Conor Ryan's contracts",
    steps: [
      {
        type: 'email',
        action: "Draft email to O'Brien & Co",
        to: 'contracts@obrienco.ie',
        subject: 'Contracts — Ryan Family, Unit A1, The Coppice',
        body: "Dear Team,\n\nFollowing up on the contract pack for the Ryan Family at Unit A1, The Coppice. The contracts were issued 22 January and are now 3 days overdue.\n\nCould you confirm receipt and advise on the expected signing date?\n\nKind regards,\nSarah Collins\nSherry FitzGerald Cork",
      },
      {
        type: 'status',
        action: 'Flag A1 as overdue in pipeline',
        detail: "Unit A1 marked 'Contracts Overdue'. Pipeline updated.",
      },
      {
        type: 'reminder',
        action: 'Set follow-up reminder',
        detail: "Reminder set for 29 Jan — follow up if no response from O'Brien & Co.",
      },
    ],
  },
  {
    input: 'Draft weekly report for Cairn Homes',
    steps: [
      {
        type: 'report',
        action: 'Compile weekly report — The Coppice',
        detail: "The Coppice — Week ending 26 Jan\n\n• 4 viewings this week\n• 2 new Daft.ie enquiries\n• 1 deposit received (Unit B4)\n• Contracts overdue: A1 (3 days), B2 (1 day)\n• AIP outstanding: Mark Brennan, A5\n• 31 of 48 units sold (65%)",
      },
    ],
  },
  {
    input: 'Follow up with Mark Brennan about his AIP',
    steps: [
      {
        type: 'email',
        action: 'Draft message to Mark Brennan',
        to: 'm.brennan@gmail.com',
        subject: 'Quick update — Coppice A5',
        body: "Hi Mark,\n\nJust checking in on the AIP — have you heard back from the AIB broker? We're holding A5 but will need the approval in place shortly.\n\nWhat's your timeline looking like?\n\nThanks,\nSarah",
      },
      {
        type: 'status',
        action: 'Log AIP follow-up in pipeline',
        detail: "Note added to Mark Brennan's record: AIP follow-up sent 26 Jan.",
      },
    ],
  },
  {
    input: 'Email all buyers with contracts outstanding',
    steps: [
      {
        type: 'email',
        action: 'Draft to Conor Ryan',
        to: 'c.ryan@gmail.com',
        subject: 'Your contracts — Unit A1',
        body: "Hi Conor,\n\nJust checking in on the contract pack for A1. Has your solicitor been in touch? Let me know if there's anything I can help move along.\n\nSarah",
      },
      {
        type: 'email',
        action: 'Draft to R & K Donovan',
        to: 'r.donovan@gmail.com',
        subject: 'Your contracts — 14 Fernwood Avenue',
        body: "Hi,\n\nFollowing up on contracts for 14 Fernwood. Could you ask your solicitor to confirm receipt? We'd like to keep things moving.\n\nThanks,\nSarah",
      },
    ],
  },
];
