/**
 * Booking Flow Simulator CLI (docs/14 §D).
 *   npm run simulate                    → all 13 scenarios with assertions (CI mode)
 *   npm run simulate:one -- 6           → single scenario, verbose
 */
import { Simulator } from './simulator';

async function main() {
  const args = process.argv.slice(2);
  const assert = args.includes('--assert') || args.includes('--all');
  const single = args.find((a) => /^\d+$/.test(a));
  const sim = new Simulator();

  const print = (r: any) => {
    const flag = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`\n${flag}  Scenario ${r.id}: ${r.name}`);
    console.log(`   Expected: ${r.expected}`);
    for (const s of r.steps) console.log(`   • ${s}`);
    if (r.stateTimeline?.length) console.log(`   States: ${r.stateTimeline.join(' → ')}`);
    for (const e of r.exceptions) console.log(`   Exception: ${e.type} → ${e.routedRole} [${e.status}] SLA ${e.slaDueAt}`);
    if (r.finalState) console.log(`   Final state: ${r.finalState}${r.touchless !== undefined ? ` · touchless=${r.touchless}` : ''}`);
    if (r.failReason) console.log(`   Fail reason: ${r.failReason}`);
  };

  if (single) {
    print(await sim.run(parseInt(single, 10)));
    return;
  }
  const { reports, passed, failed } = await sim.runAll();
  reports.forEach(print);
  console.log(`\n══════════════════════════════════════════`);
  console.log(`Simulator result: ${passed}/13 passed, ${failed} failed`);
  console.log(`══════════════════════════════════════════`);
  if (assert && failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
