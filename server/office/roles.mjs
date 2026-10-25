// AI ofis xodimlari va boshqaruv kengashi. Kim ishlashi profile.json da: kompaniya, egasi, xodimlar (staff) va kengashda
// o'tiradigan a'zolar (board). Kengash a'zolari board.json kutubxonasidan olinadi: har biri mashhur rahbarlarning ochiq
// tamoyillaridan ilhomlangan uslub, haqiqiy odam emas. Har rolning o'z asosiy modeli (prefer) bor, shunda majlisda har
// xil modellar gapiradi. Yangi xodimni direktor "vakansiya" orqali so'raydi, egasi tasdiqlasa state.roles ga qo'shiladi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const readJSON = (f) => JSON.parse(fs.readFileSync(path.resolve(DIR, f), "utf8"));

export const PROFILE = readJSON(process.env.OFFICE_PROFILE || "profile.json");
export const LIBRARY = readJSON(process.env.OFFICE_BOARD || "board.json").members;
export const BASE_ROLES = PROFILE.staff;

export const BOARD = (PROFILE.board || []).map((id, i) => {
  const m = LIBRARY.find((x) => x.id === id);
  if (!m) throw new Error(`profile.json: kengash a'zosi "${id}" board.json da yo'q`);
  return { ...m, board: true, prefer: i,
    job: `Boshqaruv kengashi a'zosisan. Biznesni o'z tamoyillaring nuqtai nazaridan baholaysan va aniq maslahat berasan.` };
});

export function allRoles(state) {
  return [...BASE_ROLES, ...(state.roles || [])];
}

// Xodimlar va kengash a'zolari birga: majlisda kim gapirsa ham shu ro'yxatdan topiladi.
export function everyone(state) {
  return [...allRoles(state), ...BOARD];
}

export function systemPrompt(role, facts) {
  const { company, owner } = PROFILE;
  return [
    role.board
      ? `Sen ${company} kompaniyasining AI boshqaruv kengashi a'zosisan. Uslubing: ${role.title}.`
      : `Sen ${company} kompaniyasining AI ofisidagi xodimsan. Lavoziming: ${role.title}.`,
    `Vazifang: ${role.job}`,
    ...(role.board ? [
      "Sening tamoyillaring (har maslahatingni shulardan kelib chiqib ber):",
      ...role.principles.map((p) => `- ${p}`),
      "Sen hech qaysi haqiqiy odam emassan: hech kimning nomidan gapirma, \"falonchi shunday qilardi\" dema."
    ] : []),
    `Kompaniya egasi va yakuniy qaror qiluvchi: ${owner}. Mijozga ketadigan hamma narsani u tasdiqlaydi.`,
    "Faqat o'zbek tilida (lotin) yoz, agar boshqa til so'ralmasa. Qisqa va aniq yoz.",
    "Quyidagi faktlardan tashqari hech narsa va'da qilma, raqam to'qima. Bilmasang, \"bilmayman\" de.",
    "",
    facts
  ].join("\n");
}
