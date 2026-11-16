#!/usr/bin/env node
// Fail-closed model promotion gate: historical exploratory results cannot authorize release.
import fs from 'node:fs';
export function releaseGate(report, evidence={}){
 const issues=[];
 const n=Number(report.games),accuracy=Number(report.accuracy),brier=Number(report.brier),loss=Number(report.log_loss);
 const selected=Number(report.high_confidence_games),coverage=Number(report.high_confidence_coverage),hit=Number(report.high_confidence_accuracy);
 const ci=report.high_confidence_95ci;
 if(!Number.isInteger(n)||n<500)issues.push('At least 500 evaluated games required');
 if(!Number.isFinite(accuracy)||accuracy<0||accuracy>1||!Number.isFinite(brier)||brier<0||brier>1||!Number.isFinite(loss)||loss<0)issues.push('Invalid all-game accuracy, Brier or log loss');
 if(!Number.isInteger(selected)||selected<100||selected>n)issues.push('At least 100 high-confidence selections required');
 if(!Number.isFinite(coverage)||coverage<.05||Math.abs(coverage-selected/n)>1e-8)issues.push('High-confidence coverage must be >=5% and consistent');
 if(!Number.isFinite(hit)||hit<.75)issues.push('High-confidence accuracy must be >=75%');
 if(!ci||!Number.isFinite(ci.lower)||!Number.isFinite(ci.upper)||ci.lower<.75||ci.upper>1||ci.lower>ci.upper)issues.push('95% confidence lower bound must be >=75%');
 if(evidence.prospective!==true)issues.push('Prospective predictions must be timestamped and locked before kickoff');
 if(evidence.point_in_time_features!==true)issues.push('All features must be proven available before kickoff');
 if(evidence.no_test_season_tuning!==true)issues.push('No test-season fitting or threshold selection');
 if(evidence.android_pwa_verified!==true)issues.push('Android PWA installation, offline, update and accessibility tests required');
 if(evidence.ci_passed!==true)issues.push('Current commit CI must pass');
 return {ready:issues.length===0,issues,warning:'Passing this research gate is necessary, not sufficient, for production release. Never authorizes wagering.'};
}
if(process.argv[1]?.endsWith('release-gate.mjs')){try{
 const [reportFile,evidenceFile]=process.argv.slice(2);
 if(!reportFile)throw Error('Usage: release-gate.mjs calibration-report.json [evidence.json]');
 const r=releaseGate(JSON.parse(fs.readFileSync(reportFile,'utf8')),evidenceFile?JSON.parse(fs.readFileSync(evidenceFile,'utf8')):{});
 console.log(JSON.stringify(r,null,2));if(!r.ready)process.exitCode=2;
}catch(e){console.error(e.message);process.exitCode=1}}
