/**
 * ครอบสตริงด้วย single quote ให้ปลอดภัยเวลาเอาไปต่อเป็น shell command
 * (ชื่อไฟล์อาจมีช่องว่าง, $, ;, ` หรือ ' ปนมา)
 * วิธีมาตรฐาน: ปิด quote → ใส่ escaped quote → เปิด quote ใหม่  =>  '\''
 */
export function shQuote(s: string): string {
  return `'${s.split("'").join(`'\\''`)}'`
}
