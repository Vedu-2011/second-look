import { describe, expect, it } from "vitest";
import { isPlausibleNdc, ndcCandidates, productCodeOf } from "./ndc";

const codes = (input: string) => ndcCandidates(input).map((c) => c.productCode);

describe("ndcCandidates", () => {
  it("reads every dashed package layout", () => {
    expect(codes("0573-0160-17")).toEqual(["005730160"]); // 4-4-2
    expect(codes("11673-484-08")).toEqual(["116730484"]); // 5-3-2
    expect(codes("12345-6789-1")).toEqual(["123456789"]); // 5-4-1
    expect(codes("00573-0160-17")).toEqual(["005730160"]); // 5-4-2 (11-digit with dashes)
  });

  it("reads product codes without the package part", () => {
    expect(codes("0573-0160")).toEqual(["005730160"]);
    expect(codes("11673-484")).toEqual(["116730484"]);
    expect(codes("00113-0517")).toEqual(["001130517"]);
  });

  it("reads undashed 11- and 9-digit numbers", () => {
    expect(codes("00573016017")).toEqual(["005730160"]);
    expect(codes("005730160")).toEqual(["005730160"]);
  });

  it("tries all three layouts for a bare 10-digit number, most common first", () => {
    expect(codes("0573016017")).toEqual(["005730160", "057300160", "057301601"]);
  });

  it("accepts an NDC prefix, spaces and odd dashes", () => {
    expect(codes("NDC 0573-0160-17")).toEqual(["005730160"]);
    expect(codes(" ndc: 0573 0160 17 ")).toEqual(["005730160"]);
    expect(codes("0573–0160–17")).toEqual(["005730160"]);
  });

  it("returns nothing for garbage", () => {
    for (const bad of ["", "garbage", "12", "1234-5", "123456-12-12", "0573-01a0", "1-2-3"]) {
      expect(ndcCandidates(bad), bad).toEqual([]);
    }
    expect(isPlausibleNdc(null)).toBe(false);
    expect(isPlausibleNdc("0573-0160")).toBe(true);
  });

  it("gives display form and maps RxNav ndc9 to product codes", () => {
    expect(ndcCandidates("573-160-17")[0]?.display).toBeUndefined(); // 3-3-2 isn't a real layout
    expect(ndcCandidates("0573-0160")[0]?.display).toBe("00573-0160");
    expect(productCodeOf("11822-4484")).toBe("118224484");
  });
});
