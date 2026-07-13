// 简单单元测试 - 通过 tsx 跑 TS
// 覆盖: 空风圈、缺失坐标、热带低压、异常 JSON、超时

import { normalize, parseCoord, jmaTimeToUtcIso, classNameZh, beaufortFromMs } from "../lib/jma";
import { getTyphoonBavi, __cache } from "../lib/cache";
import assert from "node:assert";

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✔ ${name}`);
  } catch (e) {
    console.error(`✘ ${name}\n   ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

(async () => {
  await test("parseCoord: 数字半球", () => {
    assert.deepStrictEqual(parseCoord("34.1N", "118.2E"), { lat: 34.1, lon: 118.2 });
    assert.deepStrictEqual(parseCoord("10.5S", "20.0W"), { lat: -10.5, lon: -20 });
  });
  await test("parseCoord: 空/无效输入返回 null", () => {
    assert.strictEqual(parseCoord(null, "118.2E"), null);
    assert.strictEqual(parseCoord("", ""), null);
    assert.strictEqual(parseCoord("abc", "118.2E"), null);
  });
  await test("jmaTimeToUtcIso: JST->UTC", () => {
    const iso = jmaTimeToUtcIso("2026/07/13 15:00");
    // 15:00 JST = 06:00 UTC
    assert.ok(iso && iso.startsWith("2026-07-13T06:00:00"));
  });
  await test("classNameZh: 映射", () => {
    assert.strictEqual(classNameZh("TS"), "热带风暴");
    assert.strictEqual(classNameZh("TY"), "台风");
    assert.strictEqual(classNameZh("TD"), "热带低压");
    assert.strictEqual(classNameZh("LOW"), "温带气旋 / 低压");
  });
  await test("beaufortFromMs: 边界值", () => {
    assert.strictEqual(beaufortFromMs(0), 0);
    assert.strictEqual(beaufortFromMs(17), 7);
    assert.strictEqual(beaufortFromMs(18), 8);
    assert.strictEqual(beaufortFromMs(33), 12);
    assert.strictEqual(beaufortFromMs(50), 15);
  });

  // 1. 空风圈场景
  await test("normalize: 空风圈", () => {
    const r = normalize({
      reportDateTime: "2026/07/13 15:00",
      targetDateTime: "2026/07/13 15:00",
      targetDuration: "PT120H",
      name: "TEST",
      number: "0000",
      remark: "",
      meteorologicalInfos: [
        {
          dateTime: "2026/07/13 15:00",
          classPart: { typhoonClass: "TS", typhoonClassName: "热带风暴", areaClass: "", intensityAndTyphoonClass: "热带风暴" },
          centerPart: { coordinateLat: "20.0N", coordinateLon: "120.0E", probabilityCircle: null, direction: "N", speedKnot: "10", speedKmH: "20", pressure: "1000" },
          windPart: { windSpeedKnot: "35", windSpeedKnotCondition: "なし", windSpeedMS: "18", windSpeedMSCondition: "なし", windGustSpeedKnot: "50", windGustSpeedMS: "25" },
          warningAreaPart50: [],
          warningAreaPart30: [],
        },
      ],
    });
    assert.strictEqual(r.current?.lat, 20);
    assert.strictEqual(r.current?.lon, 120);
    assert.deepStrictEqual(r.windRadii, []);
    assert.strictEqual(r.current?.className, "热带风暴");
  });

  // 2. 缺失坐标场景
  await test("normalize: 缺失坐标降级为 null", () => {
    const r = normalize({
      reportDateTime: "2026/07/13 15:00",
      targetDateTime: "2026/07/13 15:00",
      targetDuration: "PT120H",
      name: "TEST",
      number: "0000",
      remark: "",
      meteorologicalInfos: [
        {
          dateTime: "2026/07/13 15:00",
          classPart: { typhoonClass: "TD", typhoonClassName: "热带低压" },
          centerPart: { coordinateLat: "", coordinateLon: "", probabilityCircle: null, direction: "N", speedKnot: "5", speedKmH: "9", pressure: "1004" },
          windPart: { windSpeedKnot: "0", windSpeedMS: "0", windGustSpeedKnot: "0", windGustSpeedMS: "0" },
          warningAreaPart50: null,
          warningAreaPart30: null,
        },
      ],
    });
    assert.strictEqual(r.current?.lat, null);
    assert.strictEqual(r.current?.lon, null);
    assert.strictEqual(r.current?.classCode, "TD");
  });

  // 3. 概率圈
  await test("normalize: 概率圈通过 probabilityCircle.basePoint 解析", () => {
    const r = normalize({
      reportDateTime: "2026/07/13 15:00",
      targetDateTime: "2026/07/13 15:00",
      targetDuration: "PT120H",
      name: "TEST",
      number: "0000",
      remark: "",
      meteorologicalInfos: [
        {
          dateTime: "2026/07/13 09:00", // i=0 之前一个, 但是这里 i 只能为 0
          classPart: { typhoonClass: "TD", typhoonClassName: "热带低压" },
          centerPart: { coordinateLat: "20.0N", coordinateLon: "120.0E", probabilityCircle: null, direction: "N", speedKnot: "5", speedKmH: "9", pressure: "1004" },
          windPart: { windSpeedKnot: "0", windSpeedMS: "0", windGustSpeedKnot: "0", windGustSpeedMS: "0" },
        },
        {
          dateTime: "2026/07/14 09:00",
          classPart: { typhoonClass: "TD", typhoonClassName: "热带低压" },
          centerPart: { coordinateLat: null, coordinateLon: null, probabilityCircle: { basePointLat: "21.0N", basePointLon: "121.0E", axis: { direction: "ALL", radiusNm: "100", radiusKm: "185" } }, direction: "N", speedKnot: "5", speedKmH: "9", pressure: "1004" },
          windPart: { windSpeedKnot: "0", windSpeedMS: "0", windGustSpeedKnot: "0", windGustSpeedMS: "0" },
        },
      ],
    });
    assert.strictEqual(r.current?.lat, 20);
    assert.strictEqual(r.current?.lon, 120);
    assert.strictEqual(r.forecast[0]?.lat, 21);
    assert.strictEqual(r.forecast[0]?.lon, 121);
    assert.strictEqual(r.forecast[0]?.probRadiusKm, 185);
  });

  // 4. 时间偏移
  await test("normalize: offsetHours 计算", () => {
    const r = normalize({
      reportDateTime: "2026/07/13 15:00",
      targetDateTime: "2026/07/13 15:00",
      targetDuration: "PT120H",
      name: "TEST",
      number: "0000",
      remark: "",
      meteorologicalInfos: [
        {
          dateTime: "2026/07/13 15:00",
          classPart: { typhoonClass: "TS", typhoonClassName: "热带风暴" },
          centerPart: { coordinateLat: "20.0N", coordinateLon: "120.0E", probabilityCircle: null, direction: "N", pressure: "1000" },
          windPart: { windSpeedMS: "18" },
        },
        {
          dateTime: "2026/07/14 15:00",
          classPart: { typhoonClass: "TS", typhoonClassName: "热带风暴" },
          centerPart: { coordinateLat: null, coordinateLon: null, probabilityCircle: { basePointLat: "25.0N", basePointLon: "125.0E", axis: { direction: "ALL", radiusKm: "100" } }, direction: "N" },
          windPart: { windSpeedMS: "18" },
        },
        {
          dateTime: "2026/07/15 15:00",
          classPart: { typhoonClass: "TS", typhoonClassName: "热带风暴" },
          centerPart: { coordinateLat: null, coordinateLon: null, probabilityCircle: { basePointLat: "30.0N", basePointLon: "130.0E", axis: { direction: "ALL", radiusKm: "200" } }, direction: "N" },
          windPart: { windSpeedMS: "18" },
        },
      ],
    });
    assert.strictEqual(r.current?.offsetHours, 0);
    assert.strictEqual(r.forecast[0]?.offsetHours, 24);
    assert.strictEqual(r.forecast[1]?.offsetHours, 48);
  });

  // 5. 真实接口
  await test("cache: 真实 JMA 接口成功", async () => {
    
    __cache.clear();
    const r = await getTyphoonBavi("cn_zs");
    if (!r.ok && !r.current) {
      throw new Error("无 current 数据: " + r.error);
    }
    assert.strictEqual(r.storm.name, "BAVI");
    assert.strictEqual(r.storm.nameZh, "巴威");
    assert.strictEqual(r.storm.number, "2609");
    assert.ok(r.current, "current 应存在");
    assert.ok(typeof r.current?.lat === "number");
    assert.ok(typeof r.current?.lon === "number");
    assert.ok(typeof r.current?.pressureHpa === "number");
    assert.ok(typeof r.current?.windMs === "number");
    console.log("  -> current:", r.current?.lat, r.current?.lon, "p=", r.current?.pressureHpa, "w=", r.current?.windMs);
    console.log("  -> forecast count:", r.forecast.length);
  });

  // 6. 主机失败
  await test("cache: 主机不可达时保留上一次数据并标记 stale", async () => {
    
    __cache.clear();
    const first = await getTyphoonBavi("cn_zs");
    if (!first.current) throw new Error("需要先获取到数据");
    const oldFetch = global.fetch;
    global.fetch = (async () => { throw new Error("simulated network down"); }) as typeof fetch;
    const entry = __cache.get("cn_zs");
    if (entry) entry.fetchedAt = 0;
    const second = await getTyphoonBavi("cn_zs");
    global.fetch = oldFetch;
    assert.strictEqual(second.stale, true, "应标记 stale");
    assert.ok(second.error && second.error.includes("simulated network down"));
    assert.strictEqual((second.current as { lat: number })?.lat, (first.current as { lat: number })?.lat);
    console.log("  -> 保留了上次数据, stale=", second.stale);
  });

  // 7. 异常 JSON
  await test("cache: JMA 返回非 JSON 时保留上一次数据", async () => {
    
    __cache.clear();
    const first = await getTyphoonBavi("cn_zs");
    if (!first.current) throw new Error("需要先获取到数据");
    const oldFetch = global.fetch;
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      text: async () => "<html>not json</html>",
    })) as unknown as typeof fetch;
    const entry = __cache.get("cn_zs");
    if (entry) entry.fetchedAt = 0;
    const second = await getTyphoonBavi("cn_zs");
    global.fetch = oldFetch;
    assert.strictEqual(second.stale, true);
    assert.ok(second.error);
    console.log("  -> 非 JSON 错误处理 OK");
  });

  // 8. 字段缺失
  await test("cache: 缺 meteorologicalInfos 时返回空", async () => {
    
    __cache.clear();
    const oldFetch = global.fetch;
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ name: "X" }),
    })) as unknown as typeof fetch;
    const r = await getTyphoonBavi("en");
    global.fetch = oldFetch;
    assert.strictEqual(r.stale, true);
    assert.ok(r.error);
    assert.strictEqual(r.current, null);
    console.log("  -> 字段缺失处理 OK");
  });

  // 9. 并发去重
  await test("cache: 并发请求去重", async () => {
    
    __cache.clear();
    const oldFetch = global.fetch;
    let callCount = 0;
    global.fetch = (async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          reportDateTime: "2026/07/13 15:00",
          targetDateTime: "2026/07/13 15:00",
          targetDuration: "PT120H",
          name: "BAVI",
          number: "2609",
          remark: "",
          meteorologicalInfos: [
            {
              dateTime: "2026/07/13 15:00",
              classPart: { typhoonClass: "TS", typhoonClassName: "热带风暴" },
              centerPart: { coordinateLat: "34.0N", coordinateLon: "118.0E", probabilityCircle: null, direction: "N", pressure: "990" },
              windPart: { windSpeedMS: "18" },
            },
          ],
        }),
      };
    }) as unknown as typeof fetch;
    const a = getTyphoonBavi("en");
    const b = getTyphoonBavi("en");
    const c = getTyphoonBavi("en");
    const [ra, rb, rc] = await Promise.all([a, b, c]);
    global.fetch = oldFetch;
    assert.strictEqual(callCount, 1, "3 个并发请求应只调用 1 次");
    assert.strictEqual((ra.current as { lat: number })?.lat, (rb.current as { lat: number })?.lat);
    assert.strictEqual((ra.current as { lat: number })?.lat, (rc.current as { lat: number })?.lat);
    console.log("  -> 并发去重 OK, fetch 调用次数=", callCount);
  });

  console.log("\n全部测试通过.");
})();
