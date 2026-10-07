import type { Locale } from "./i18n";

export type FieldRule = { label: string; required?: boolean; min?: number; max?: number; kind?: "email" | "phone" | "postcode" | "postal-code" | "quantity" | "date" | "consent"; options?: readonly string[] };
export type FieldRules = Record<string, FieldRule>;
export type FieldErrors = Record<string, string>;
export type FormValues = Record<string, string>;
export const CUSTOMER_DRAFT_TTL = 24 * 60 * 60 * 1000;
export const customerFormCopy = {
  ar: {
    errors: "يُرجى مراجعة هذه البيانات", required: "أكمل هذا الحقل.", consent: "أكّد الموافقة قبل الإرسال.", email: "أدخل بريدًا إلكترونيًا صحيحًا، مثل name@example.com.", phone: "أدخل رقم هاتف من 7 إلى 30 خانة، باستخدام الأرقام والمسافات والرموز + ( ) . أو -.", postcode: "أدخل رمزًا بريديًا تايلانديًا من 5 أرقام.", quantity: "أدخل عددًا صحيحًا من 1 إلى 1,000,000.", date: "اختر تاريخًا صحيحًا.", choice: "اختر أحد الخيارات المتاحة.", min: (n: number) => `الحد الأدنى لعدد الأحرف: ${n.toLocaleString("ar")}.`, max: (n: number) => `الحد الأقصى لعدد الأحرف: ${n.toLocaleString("ar")}.`,
    remember: "الاحتفاظ ببياناتي غير المكتملة على هذا الجهاز", rememberHint: "اختياري. تُحفظ في هذا المتصفح لمدة تصل إلى 24 ساعة. تجنّب هذا الخيار على الأجهزة المشتركة. لا تُحفظ الموافقة أو بيانات الدفع.", available: "لديك بيانات غير مكتملة محفوظة في هذا المتصفح.", restore: "استعادة البيانات", discard: "حذف البيانات المحفوظة", saved: "حُفظت البيانات غير المكتملة على هذا الجهاز.", recovered: "استُعيدت البيانات. يُرجى مراجعتها وتأكيد الموافقة مجددًا.", unavailable: "تعذّر حفظ البيانات في هذا المتصفح. أبقِ الصفحة مفتوحة للاحتفاظ بما أدخلته.", deleteFailed: "تعذّر حذف النسخة المحفوظة. امسح بيانات هذا الموقع من المتصفح لإزالتها من الجهاز.", requiredHint: "الحقول المعلّمة بالرمز * مطلوبة.", contactDetails: "بيانات التواصل", deliveryDetails: "بيانات التوصيل", optionalDetails: "هل تودّ إضافة شيء؟", messageDetails: "كيف يمكننا مساعدتك؟", messageHint: "اكتب 10 أحرف على الأقل لنتمكن من فهم طلبك.", postcodeHint: "استخدم الرمز البريدي لعنوان التوصيل في تايلاند، المكوّن من 5 أرقام.", saving: "جارٍ حفظ بياناتك. يُرجى إبقاء هذه الصفحة مفتوحة.",
  },
  en: {
    errors: "Please check these details", required: "Complete this field.", consent: "Confirm your agreement before sending.", email: "Enter a valid email address, such as name@example.com.", phone: "Enter a phone number with 7–30 characters, using numbers, spaces, +, ( ), . or -.", postcode: "Enter a 5-digit Thai postcode.", quantity: "Enter a whole number from 1 to 1,000,000.", date: "Choose a valid date.", choice: "Choose an available option.", min: (n: number) => `Enter at least ${n} characters.`, max: (n: number) => `Use no more than ${n} characters.`,
    remember: "Keep my unfinished details on this device", rememberHint: "Optional. Stored in this browser for up to 24 hours. Avoid this on a shared device. Your agreement and payment details are never saved.", available: "You have unfinished details saved in this browser.", restore: "Restore details", discard: "Delete saved details", saved: "Unfinished details are saved on this device.", recovered: "Details restored. Please review them and confirm your agreement again.", unavailable: "This browser could not save your details. Keep this page open to retain your input.", deleteFailed: "The saved copy could not be removed. Clear this site's browser storage to remove it from this device.", requiredHint: "Fields marked * are required.", contactDetails: "Your contact details", deliveryDetails: "Delivery details", optionalDetails: "Anything else?", messageDetails: "How can we help?", messageHint: "Please include at least 10 characters so we can understand your request.", postcodeHint: "Use the 5-digit delivery postcode in Thailand.", saving: "Your details are being saved. Please keep this page open.",
  },
  th: {
    errors: "กรุณาตรวจสอบข้อมูลต่อไปนี้", required: "กรุณากรอกข้อมูลช่องนี้", consent: "กรุณายืนยันความยินยอมก่อนส่ง", email: "กรุณากรอกอีเมลให้ถูกต้อง เช่น name@example.com", phone: "กรุณากรอกหมายเลขโทรศัพท์ 7–30 ตัวอักษร ใช้ตัวเลข ช่องว่าง + ( ) . หรือ -", postcode: "กรุณากรอกรหัสไปรษณีย์ไทย 5 หลัก", quantity: "กรุณากรอกจำนวนเต็มตั้งแต่ 1 ถึง 1,000,000", date: "กรุณาเลือกวันที่ให้ถูกต้อง", choice: "กรุณาเลือกตัวเลือกที่มีอยู่", min: (n: number) => `กรุณากรอกอย่างน้อย ${n} ตัวอักษร`, max: (n: number) => `กรุณากรอกไม่เกิน ${n} ตัวอักษร`,
    remember: "เก็บข้อมูลที่ยังกรอกไม่เสร็จไว้ในอุปกรณ์นี้", rememberHint: "เลือกได้ เก็บในเบราว์เซอร์นี้สูงสุด 24 ชั่วโมง ไม่แนะนำสำหรับอุปกรณ์ที่ใช้ร่วมกัน ไม่เก็บความยินยอมหรือข้อมูลการชำระเงิน", available: "มีข้อมูลที่ยังกรอกไม่เสร็จอยู่ในเบราว์เซอร์นี้", restore: "นำข้อมูลกลับมา", discard: "ลบข้อมูลที่เก็บไว้", saved: "เก็บข้อมูลที่ยังกรอกไม่เสร็จไว้ในอุปกรณ์นี้แล้ว", recovered: "นำข้อมูลกลับมาแล้ว กรุณาตรวจสอบและยืนยันความยินยอมอีกครั้ง", unavailable: "เบราว์เซอร์นี้ยังเก็บข้อมูลไม่ได้ กรุณาเปิดหน้านี้ไว้เพื่อรักษาข้อมูลที่กรอก", deleteFailed: "ยังลบสำเนาที่เก็บไว้ไม่ได้ กรุณาล้างข้อมูลเว็บไซต์ในเบราว์เซอร์เพื่อลบข้อมูลจากอุปกรณ์นี้", requiredHint: "ช่องที่มี * เป็นข้อมูลที่จำเป็น", contactDetails: "ข้อมูลติดต่อ", deliveryDetails: "ข้อมูลจัดส่ง", optionalDetails: "ข้อมูลเพิ่มเติม", messageDetails: "เรื่องที่ต้องการสอบถาม", messageHint: "กรุณาระบุอย่างน้อย 10 ตัวอักษร เพื่อให้เราเข้าใจคำถามของคุณ", postcodeHint: "ใช้รหัสไปรษณีย์ที่อยู่จัดส่งในประเทศไทย 5 หลัก", saving: "กำลังบันทึกข้อมูล กรุณาเปิดหน้านี้ไว้",
  },
};

/** Accept Arabic-Indic digits while keeping the API's ASCII numeric contract. */
export function normalizeCustomerNumber(value: string): string {
  return value.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x06f0 ? 0x06f0 : 0x0660)));
}

export function validateCustomerFields(values: FormValues, rules: FieldRules, locale: Locale): FieldErrors {
  const c = customerFormCopy[locale], errors: FieldErrors = {};
  for (const [name, rule] of Object.entries(rules)) {
    const raw = (values[name] ?? "").trim();
    const value = ["phone", "postcode", "postal-code", "quantity"].includes(rule.kind ?? "") ? normalizeCustomerNumber(raw) : raw;
    if (rule.kind === "consent") { if (value !== "on") errors[name] = c.consent; continue; }
    if (!value) { if (rule.required) errors[name] = c.required; continue; }
    if (rule.min && value.length < rule.min) errors[name] = c.min(rule.min);
    else if (rule.max && value.length > rule.max) errors[name] = c.max(rule.max);
    else if (rule.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[name] = c.email;
    else if (rule.kind === "phone" && !/^[+()\d\s.-]{7,30}$/.test(value)) errors[name] = c.phone;
    else if (rule.kind === "postcode" && !/^\d{5}$/.test(value)) errors[name] = c.postcode;
    else if (rule.kind === "postal-code" && !/^[\p{L}\p{N}][\p{L}\p{N} -]{1,18}[\p{L}\p{N}]$/u.test(value)) errors[name] = locale === "ar" ? "أدخل رمزًا بريديًا من 3 إلى 20 حرفًا أو رقمًا، ويمكن استخدام مسافة أو شرطة." : "Enter a postal code with 3–20 letters or numbers. Spaces and hyphens are allowed.";
    else if (rule.kind === "quantity" && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 1_000_000)) errors[name] = c.quantity;
    else if (rule.kind === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) errors[name] = c.date;
    else if (rule.options && !rule.options.includes(value)) errors[name] = c.choice;
  }
  return errors;
}

export type FormSubmission = { id: string; fingerprint: string };
export type CustomerDraft = { version: 1; expires: number; values: FormValues; submission?: FormSubmission };
const forbiddenFields = new Set(["consent", "password", "payment", "card", "cardnumber", "cvv", "preview-method", "preview-outcome", "website"]);
export function makeCustomerDraft(values: FormValues, allowed: readonly string[], submission?: FormSubmission, now = Date.now()): CustomerDraft {
  return { version: 1, expires: now + CUSTOMER_DRAFT_TTL, values: Object.fromEntries(allowed.filter((name) => !forbiddenFields.has(name.toLowerCase()) && typeof values[name] === "string").map((name) => [name, values[name].slice(0, 5000)])), ...(submission ? { submission: { id: submission.id, fingerprint: submission.fingerprint } } : {}) };
}
export function parseCustomerDraft(raw: string | null, allowed: readonly string[], now = Date.now()): CustomerDraft | null {
  if (!raw || raw.length > 40000) return null;
  try {
    const value = JSON.parse(raw) as CustomerDraft;
    if (value.version !== 1 || !Number.isFinite(value.expires) || value.expires <= now || value.expires > now + CUSTOMER_DRAFT_TTL || !value.values || typeof value.values !== "object" || Array.isArray(value.values)) return null;
    const submission = value.submission && /^[a-f0-9-]{36}$/i.test(value.submission.id) && /^[a-f0-9]{64}$/.test(value.submission.fingerprint) ? value.submission : undefined;
    return { ...makeCustomerDraft(value.values, allowed, submission, now), expires: value.expires };
  } catch { return null; }
}

/** An opaque digest preserves retry identity without storing request/payment payloads. */
export async function customerRequestFingerprint(payload: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
