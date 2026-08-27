// Starter catalog of common Thai dishes for the food-search "quick add" flow
// — no API call, no cost, just a static reference. Values are per-100g
// estimates (commonly-cited ballpark figures, not lab-measured), meant as a
// starting point the user corrects for their own actual portion; each entry
// carries a typical serving size so the log form can pre-fill something
// reasonable instead of defaulting to a bare 100g.
export interface CatalogFood {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
  typicalGrams: number;
}

export const THAI_FOOD_CATALOG: CatalogFood[] = [
  { name: "ข้าวขาวสวย", caloriesPer100g: 130, proteinPer100g: 2.7, carbPer100g: 28, fatPer100g: 0.3, typicalGrams: 250 },
  { name: "ข้าวเหนียว", caloriesPer100g: 160, proteinPer100g: 3.5, carbPer100g: 35, fatPer100g: 0.3, typicalGrams: 180 },
  { name: "ข้าวผัดหมู", caloriesPer100g: 190, proteinPer100g: 6, carbPer100g: 24, fatPer100g: 8, typicalGrams: 350 },
  { name: "ข้าวผัดไก่", caloriesPer100g: 185, proteinPer100g: 7, carbPer100g: 24, fatPer100g: 7, typicalGrams: 350 },
  { name: "ข้าวมันไก่", caloriesPer100g: 200, proteinPer100g: 9, carbPer100g: 22, fatPer100g: 9, typicalGrams: 400 },
  { name: "ข้าวไก่ทอด", caloriesPer100g: 250, proteinPer100g: 10, carbPer100g: 25, fatPer100g: 13, typicalGrams: 350 },
  { name: "ข้าวหมูแดง", caloriesPer100g: 190, proteinPer100g: 9, carbPer100g: 25, fatPer100g: 6, typicalGrams: 350 },
  { name: "ข้าวหมูกรอบ", caloriesPer100g: 230, proteinPer100g: 9, carbPer100g: 24, fatPer100g: 11, typicalGrams: 350 },
  { name: "ผัดกะเพราหมูสับ", caloriesPer100g: 170, proteinPer100g: 12, carbPer100g: 6, fatPer100g: 11, typicalGrams: 300 },
  { name: "ผัดกะเพราไก่", caloriesPer100g: 150, proteinPer100g: 14, carbPer100g: 5, fatPer100g: 8, typicalGrams: 300 },
  { name: "ผัดกะเพราเนื้อสับ", caloriesPer100g: 175, proteinPer100g: 15, carbPer100g: 5, fatPer100g: 11, typicalGrams: 300 },
  { name: "ลาบเนื้อ", caloriesPer100g: 145, proteinPer100g: 16, carbPer100g: 5, fatPer100g: 7, typicalGrams: 200 },
  { name: "เนื้อตุ๋น (น้ำใส)", caloriesPer100g: 75, proteinPer100g: 8, carbPer100g: 2, fatPer100g: 3, typicalGrams: 300 },
  { name: "ผัดไทย", caloriesPer100g: 180, proteinPer100g: 6, carbPer100g: 24, fatPer100g: 7, typicalGrams: 300 },
  { name: "ผัดซีอิ๊ว", caloriesPer100g: 170, proteinPer100g: 7, carbPer100g: 22, fatPer100g: 6, typicalGrams: 300 },
  { name: "ราดหน้าหมู", caloriesPer100g: 140, proteinPer100g: 6, carbPer100g: 18, fatPer100g: 5, typicalGrams: 350 },
  { name: "ต้มยำกุ้ง", caloriesPer100g: 45, proteinPer100g: 5, carbPer100g: 3, fatPer100g: 1.5, typicalGrams: 400 },
  { name: "ต้มข่าไก่", caloriesPer100g: 90, proteinPer100g: 5, carbPer100g: 4, fatPer100g: 6, typicalGrams: 350 },
  { name: "แกงเขียวหวานไก่", caloriesPer100g: 120, proteinPer100g: 7, carbPer100g: 5, fatPer100g: 8, typicalGrams: 300 },
  { name: "แกงมัสมั่นเนื้อ", caloriesPer100g: 150, proteinPer100g: 8, carbPer100g: 7, fatPer100g: 10, typicalGrams: 300 },
  { name: "ส้มตำไทย", caloriesPer100g: 65, proteinPer100g: 1.5, carbPer100g: 12, fatPer100g: 1.5, typicalGrams: 200 },
  { name: "ลาบหมู", caloriesPer100g: 140, proteinPer100g: 14, carbPer100g: 5, fatPer100g: 7, typicalGrams: 200 },
  { name: "น้ำตกหมู", caloriesPer100g: 150, proteinPer100g: 15, carbPer100g: 4, fatPer100g: 8, typicalGrams: 200 },
  { name: "ก๋วยเตี๋ยวน้ำหมู", caloriesPer100g: 60, proteinPer100g: 4, carbPer100g: 8, fatPer100g: 1.5, typicalGrams: 450 },
  { name: "ก๋วยเตี๋ยวเรือ", caloriesPer100g: 70, proteinPer100g: 5, carbPer100g: 8, fatPer100g: 2, typicalGrams: 400 },
  { name: "บะหมี่หมูแดง", caloriesPer100g: 130, proteinPer100g: 6, carbPer100g: 18, fatPer100g: 4, typicalGrams: 400 },
  { name: "เกาเหลาเลือดหมู", caloriesPer100g: 55, proteinPer100g: 6, carbPer100g: 3, fatPer100g: 2, typicalGrams: 400 },
  { name: "ไข่เจียว", caloriesPer100g: 220, proteinPer100g: 12, carbPer100g: 1, fatPer100g: 18, typicalGrams: 100 },
  { name: "ไข่ดาว", caloriesPer100g: 195, proteinPer100g: 13, carbPer100g: 1, fatPer100g: 15, typicalGrams: 55 },
  { name: "ไข่ต้ม", caloriesPer100g: 155, proteinPer100g: 13, carbPer100g: 1, fatPer100g: 11, typicalGrams: 50 },
  { name: "หมูสะเต๊ะ", caloriesPer100g: 220, proteinPer100g: 20, carbPer100g: 6, fatPer100g: 13, typicalGrams: 120 },
  { name: "ไก่ย่าง", caloriesPer100g: 190, proteinPer100g: 27, carbPer100g: 0, fatPer100g: 9, typicalGrams: 200 },
  { name: "หมูปิ้ง", caloriesPer100g: 210, proteinPer100g: 19, carbPer100g: 4, fatPer100g: 13, typicalGrams: 100 },
  { name: "มะม่วงข้าวเหนียว", caloriesPer100g: 190, proteinPer100g: 3, carbPer100g: 35, fatPer100g: 5, typicalGrams: 250 },
  { name: "กล้วยทอด", caloriesPer100g: 260, proteinPer100g: 2, carbPer100g: 40, fatPer100g: 10, typicalGrams: 100 },
  { name: "ปาท่องโก๋", caloriesPer100g: 400, proteinPer100g: 7, carbPer100g: 45, fatPer100g: 22, typicalGrams: 60 },
  { name: "โจ๊กหมู", caloriesPer100g: 55, proteinPer100g: 4, carbPer100g: 7, fatPer100g: 1, typicalGrams: 400 },
  { name: "สลัดผัก (ไม่ใส่น้ำสลัด)", caloriesPer100g: 20, proteinPer100g: 1.5, carbPer100g: 4, fatPer100g: 0.2, typicalGrams: 150 },
  { name: "ผัดผักรวม", caloriesPer100g: 60, proteinPer100g: 2, carbPer100g: 6, fatPer100g: 3, typicalGrams: 200 },
  { name: "ขนมจีนน้ำยา", caloriesPer100g: 100, proteinPer100g: 4, carbPer100g: 15, fatPer100g: 3, typicalGrams: 300 },
  { name: "แกงส้ม", caloriesPer100g: 55, proteinPer100g: 5, carbPer100g: 5, fatPer100g: 1.5, typicalGrams: 350 },
  { name: "พะโล้", caloriesPer100g: 180, proteinPer100g: 10, carbPer100g: 5, fatPer100g: 13, typicalGrams: 300 },
  { name: "หมูทอดกระเทียม", caloriesPer100g: 260, proteinPer100g: 20, carbPer100g: 5, fatPer100g: 17, typicalGrams: 150 },
  { name: "ปลาทอด", caloriesPer100g: 200, proteinPer100g: 20, carbPer100g: 3, fatPer100g: 12, typicalGrams: 200 },
  { name: "คอหมูย่าง", caloriesPer100g: 230, proteinPer100g: 22, carbPer100g: 0, fatPer100g: 15, typicalGrams: 150 },
];
