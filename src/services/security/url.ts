const HTTPS_PROTOCOL = "https:";
const LOCAL_HOST_SUFFIXES = [".localhost", ".local"];
const SENSITIVE_QUERY_NAMES =
  /^(?:api[_-]?key|key|token|access[_-]?token|auth|authorization|credential|secret|signature|sig)$/i;
const CREDENTIAL_VALUE =
  /^(?:sk-|bearer\s|gh[pousr]_|xox[baprs]-|eyJ)[A-Za-z0-9._~+/-]{8,}/i;

export function validateExternalHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== HTTPS_PROTOCOL ||
      isNonPublicHostname(url.hostname) ||
      url.username ||
      url.password ||
      (url.port !== "" && url.port !== "443") ||
      [...url.searchParams].some(
        ([name, entry]) =>
          SENSITIVE_QUERY_NAMES.test(name) || CREDENTIAL_VALUE.test(entry),
      )
    ) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function safeOpenExternal(url: string): boolean {
  const validated = validateExternalHttpsUrl(url);
  if (!validated) return false;
  window.open(validated, "_blank", "noopener,noreferrer");
  return true;
}

function isNonPublicHostname(value: string): boolean {
  const hostname = value
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "");
  if (
    !hostname ||
    (!hostname.includes(".") && !hostname.includes(":")) ||
    hostname === "localhost" ||
    LOCAL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return true;
  }

  const ipv4 = parseIpv4(hostname);
  if (ipv4) return isNonPublicIpv4(ipv4);

  const ipv6 = parseIpv6(hostname);
  return ipv6 ? isNonPublicIpv6(ipv6) : false;
}

function parseIpv4(hostname: string): [number, number, number, number] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) =>
    /^\d{1,3}$/.test(part) ? Number(part) : Number.NaN,
  );
  if (octets.some((octet) => !Number.isInteger(octet) || octet > 255)) {
    return null;
  }
  return octets as [number, number, number, number];
}

function isNonPublicIpv4([a, b, c]: [number, number, number, number]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function parseIpv6(hostname: string): number[] | null {
  if (!hostname.includes(":")) return null;
  const halves = hostname.split("::");
  if (halves.length > 2) return null;
  const head = parseIpv6Half(halves[0] ?? "");
  const tail = parseIpv6Half(halves[1] ?? "");
  if (!head || !tail) return null;
  const missing = 8 - head.length - tail.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  if (halves.length === 2 && missing < 1) return null;
  return [...head, ...Array<number>(missing).fill(0), ...tail];
}

function parseIpv6Half(value: string): number[] | null {
  if (!value) return [];
  const parts = value.split(":");
  if (parts.some((part) => !/^[\da-f]{1,4}$/i.test(part))) return null;
  return parts.map((part) => Number.parseInt(part, 16));
}

function isNonPublicIpv6(words: number[]): boolean {
  const mappedIpv4 = mappedIpv4FromIpv6(words);
  if (mappedIpv4) return isNonPublicIpv4(mappedIpv4);

  const [first = 0, second = 0, third = 0, fourth = 0] = words;
  const allZeroThroughSeventh = words.slice(0, 7).every((word) => word === 0);
  if (
    (allZeroThroughSeventh && (words[7] === 0 || words[7] === 1)) ||
    first === 0 ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xffc0) === 0xfec0 ||
    (first & 0xff00) === 0xff00 ||
    (first === 0x0100 && second === 0 && third === 0 && fourth === 0) ||
    (first === 0x0064 && second === 0xff9b && third === 1) ||
    (first === 0x2001 && second === 0) ||
    (first === 0x2001 && second === 2 && third === 0) ||
    (first === 0x2001 && (second & 0xfff0) === 0x0010) ||
    (first === 0x2001 && (second & 0xfff0) === 0x0020) ||
    (first === 0x2001 && second === 0x0db8) ||
    (first === 0x3fff && (second & 0xf000) === 0) ||
    first === 0x5f00
  ) {
    return true;
  }

  const embeddedIpv4 = transitionIpv4FromIpv6(words);
  return embeddedIpv4 ? isNonPublicIpv4(embeddedIpv4) : false;
}

function mappedIpv4FromIpv6(
  words: number[],
): [number, number, number, number] | null {
  if (!words.slice(0, 5).every((word) => word === 0) || words[5] !== 0xffff) {
    return null;
  }
  return ipv4FromWords(words[6] ?? 0, words[7] ?? 0);
}

function transitionIpv4FromIpv6(
  words: number[],
): [number, number, number, number] | null {
  if (words[0] === 0x2002) {
    return ipv4FromWords(words[1] ?? 0, words[2] ?? 0);
  }
  if (
    words[0] === 0x0064 &&
    words[1] === 0xff9b &&
    words.slice(2, 6).every((word) => word === 0)
  ) {
    return ipv4FromWords(words[6] ?? 0, words[7] ?? 0);
  }
  return null;
}

function ipv4FromWords(
  high: number,
  low: number,
): [number, number, number, number] {
  return [high >>> 8, high & 0xff, low >>> 8, low & 0xff];
}
