import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/customer-form.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = { exports: {} };
new Function("module", "exports", code)(loaded, loaded.exports);
const { validateCustomerFields: validate, makeCustomerDraft: make, parseCustomerDraft: parse, CUSTOMER_DRAFT_TTL: ttl, customerRequestFingerprint: fingerprint } = loaded.exports;
const { normalizeCustomerNumber, customerFormCopy } = loaded.exports;
let checks = 0;
function check(label, fn) { fn(); checks++; console.log(`PASS: ${label}`); }

const rules = { name: {label: "Name", required: true, max: 100}, email: {label: "Email", required: true, kind:"email"}, message: {label: "Message", min:10, max:5000, required:true}, consent:{label:"Consent",kind:"consent"} };
check("blank and whitespace required fields receive localized inline errors", () => {
  assert.deepEqual(Object.keys(validate({name:"  "},rules,"en")),["name","email","message","consent"]);
  assert.match(validate({},rules,"th").name,/กรุณา/);
});
check("valid customer input clears errors without bypassing consent", () => {
  const values={name:"Customer",email:"customer@example.test",message:"Question about honey",consent:"on"};
  assert.deepEqual(validate(values,rules,"en"),{});
  assert.equal(Object.keys(validate({...values,consent:""},rules,"en")).join(),"consent");
});
check("malformed email, short messages, and oversized names are rejected", () => {
  assert.deepEqual(Object.keys(validate({name:"x".repeat(101),email:"bad@example",message:"short",consent:"on"},rules,"en")),["name","email","message"]);
});
const delivery = { phone:{label:"Phone",required:true,kind:"phone"},postcode:{label:"Postcode",required:true,kind:"postcode"} };
check("delivery validation follows phone and Thai postal server constraints", () => {
  assert.deepEqual(validate({phone:"+66 (81) 234-5678",postcode:"10110"},delivery,"en"),{});
  assert.deepEqual(Object.keys(validate({phone:"abcdefghi",postcode:"1011"},delivery,"en")),["phone","postcode"]);
});
check("Arabic validation preserves Thai delivery rules and accepts Arabic-Indic numeric input", () => {
  assert.deepEqual(validate({ phone: "+٦٦ ٨١٢٣٤٥٦٧٨", postcode: "١٠١١٠" }, delivery, "ar"), {});
  assert.deepEqual(validate({ phone: "+۶۶ ۸۱۲۳۴۵۶۷۸", postcode: "۱۰۱۱۰" }, delivery, "ar"), {});
  assert.equal(normalizeCustomerNumber("+٦٦ (۸۱) ٢٣٤-٥٦٧٨"), "+66 (81) 234-5678");
  assert.equal(validate({ phone: "abcdefghi", postcode: "١٠١١" }, delivery, "ar").postcode, customerFormCopy.ar.postcode);
  assert.match(validate({}, rules, "ar").name, /[\u0600-\u06ff]/u);
  assert.equal(normalizeCustomerNumber("اسم@example.test"), "اسم@example.test", "Only digit characters change");
});
check("wholesale validates whole quantities, available products, and calendar dates", () => {
  const fields={quantity:{label:"Quantity",kind:"quantity",required:true},product:{label:"Product",required:true,options:["honey"]},date:{label:"Date",kind:"date"}};
  assert.deepEqual(validate({quantity:"1000000",product:"honey",date:"2028-02-29"},fields,"en"),{});
  assert.deepEqual(Object.keys(validate({quantity:"1.5",product:"removed",date:"2026-02-29"},fields,"en")),["quantity","product","date"]);
});
const now=100000, allowed=["name","email","message","consent","payment","password","cvv"];
check("draft allowlist omits consent, payment, credentials, and unknown fields", () => {
  const draft=make({name:"Customer",email:"c@example.test",message:"Question",consent:"on",payment:"secret",password:"secret",cvv:"secret",unknown:"unexpected"},allowed,undefined,now);
  assert.deepEqual(Object.keys(draft.values),["name","email","message"]);
  assert.equal(draft.expires,now+ttl);
});
check("drafts expire and cannot supply a forged long lifetime", () => {
  const draft=make({name:"Customer"},allowed,undefined,now);
  assert.ok(parse(JSON.stringify(draft),allowed,now));
  assert.equal(parse(JSON.stringify(draft),allowed,now+ttl),null);
  assert.equal(parse(JSON.stringify({...draft,expires:now+ttl+1}),allowed,now),null);
});
check("malformed or oversized recovery data is ignored safely", () => {
  for(const raw of ["oops","null","[]",'{"version":1}',"x".repeat(40001)]) assert.equal(parse(raw,allowed,now),null);
  const draft=make({name:"Customer"},allowed,undefined,now);
  assert.equal(parse(JSON.stringify({...draft,values:[]}),allowed,now),null);
  assert.deepEqual(parse(JSON.stringify({...draft,values:{name:13,email:{secret:true},consent:"on"}}),allowed,now).values,{});
});
check("opaque retry identity survives recovery; malformed identifiers are dropped", () => {
  const identity={id:"4d8e5a58-494d-48eb-8a9e-a5dccf6b5455",fingerprint:"a".repeat(64)};
  const draft=make({name:"Customer"},allowed,identity,now);
  assert.deepEqual(parse(JSON.stringify(draft),allowed,now).submission,identity);
  assert.equal(parse(JSON.stringify({...draft,submission:{id:"unexpected",fingerprint:"secret"}}),allowed,now).submission,undefined);
});
const first=await fingerprint('customer payload'), repeated=await fingerprint('customer payload'), changed=await fingerprint('changed customer payload');
assert.equal(first,repeated); assert.notEqual(first,changed); assert.match(first,/^[a-f0-9]{64}$/); checks++;
console.log("PASS: matching requests preserve retry identity and edited requests get a new fingerprint");
console.log(`${checks} customer form checks passed.`);
