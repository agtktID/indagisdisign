import { describe, expect, it } from "vitest";

import { csvCell, csvRow, neutralizeFormula } from "../../shared/csv.js";

describe("sérialisation CSV", () => {
  it("neutralise les cellules qui commencent par un caractère de formule", () => {
    expect(neutralizeFormula("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(neutralizeFormula("+1")).toBe("'+1");
    expect(neutralizeFormula("-1")).toBe("'-1");
    expect(neutralizeFormula("@cmd")).toBe("'@cmd");
  });

  it("laisse intacte une cellule ordinaire", () => {
    expect(neutralizeFormula("Ouverture calme")).toBe("Ouverture calme");
  });

  it("échappe les guillemets et les virgules", () => {
    expect(csvCell('Le tir, "lisible"')).toBe('"Le tir, ""lisible"""');
  });

  it("rend une cellule vide pour null et undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("assemble une ligne complète", () => {
    expect(csvRow([1, "=A1", 'a,b', null])).toBe(`1,'=A1,"a,b",`);
  });
});
