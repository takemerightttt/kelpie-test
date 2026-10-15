// X-File-Name must be ASCII (OkHttp on Android throws on other characters, so does Node fetch) and
// 1-255 characters long, the mock's limit.
import { fileNameHeader, ImportsApi } from "@/core/api";
import { NodeHttp, pickFixture, startMock } from "../support/node";

const ASCII = /^[\x20-\x7e]+$/;

it("percent-encodes a Cyrillic name and decodes back to it", () => {
  const header = fileNameHeader("Выписка за октябрь.csv");
  expect(header).toMatch(ASCII);
  expect(decodeURIComponent(header)).toBe("Выписка за октябрь.csv");
  expect(fileNameHeader("statement.csv")).toBe("statement.csv");
});

it("drops whole characters from the end until the encoded name fits 255", () => {
  const header = fileNameHeader("я".repeat(200));
  expect(header.length).toBeLessThanOrEqual(255);
  expect(header).toMatch(ASCII);
  expect(decodeURIComponent(header)).toBe("я".repeat(42)); // "%D1%8F" is 6 characters
});

it("the mock accepts an upload with a Cyrillic file name", async () => {
  const mock = await startMock();
  try {
    const api = new ImportsApi(new NodeHttp(mock.base));
    const picked = pickFixture("statement.csv");
    const response = await api.create(
      "cyrillic-name-key",
      "Выписка.csv",
      picked.uri,
    );
    expect(response.kind).toBe("accepted");
  } finally {
    await mock.stop();
  }
});
