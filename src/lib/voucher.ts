import type { Prisma, PrismaClient } from "@prisma/client";

function pad(n: number, w = 5) {
  return String(n).padStart(w, "0");
}
function ymKey(d: Date, prefix = "VCH") {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return { key: `${prefix}-${y}${m}`, y, m };
}
export function formatVoucherNo(d: Date, seq: number, prefix = "VCH") {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${prefix}/${y}-${m}/${pad(seq)}`;
}

/**
 * Ambil nomor voucher berikutnya (atomic) per bulan: VCH/YYYY-MM/00001
 * WAJIB dipanggil di dalam transaction tx.
 * Implementasi MySQL-safe via LAST_INSERT_ID.
 */
export async function nextVoucherNo(
  txOrPrisma: Prisma.TransactionClient | PrismaClient,
  tanggal: Date,
  prefix = "VCH"
) {
  const { key } = ymKey(tanggal, prefix);
  const client = txOrPrisma as any;

  // create-or-increment atomically, set LAST_INSERT_ID to value after increment
  await client.$executeRawUnsafe(
    `INSERT INTO SequenceCounter (\`key\`, \`value\`) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE \`value\` = LAST_INSERT_ID(\`value\` + 1)`,
    key
  );

  // HILANGKAN generic <{ seq: number }[]> → cast hasil setelahnya
  const rows = (await client.$queryRawUnsafe(
    `SELECT LAST_INSERT_ID() AS seq`
  )) as Array<{ seq: number | bigint }>;

  const raw = rows?.[0]?.seq ?? 1;
  const seq = typeof raw === "bigint" ? Number(raw) : Number(raw);

  return formatVoucherNo(tanggal, seq, prefix);
}
