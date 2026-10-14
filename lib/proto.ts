// Minimal protobuf wire-format parser + utilities.
// Structure mirrors the decompiled app:
//   PBResponse:  field 2 = code(int32), 3 = message(string),
//                4 = magic(string base64 PBMagic), 10 = data(bytes)
//   PBMagic:     field 2 = repeated Param; Param field 10 = intValue (payload offset)
//   PBBodySignatureResp: field 1 = map<int32, string> (endpoint code -> signature)

export interface Field {
  field: number;
  wire: number;
  value: number | Uint8Array;
}

export interface PBResponse {
  requestToken?: string;
  code?: number;
  message?: string;
  magic?: string;
  data?: Uint8Array;
}

export function readVarint(buf: Uint8Array, pos: number): [number, number] {
  let result = 0n;
  let shift = 0n;
  let i = pos;
  for (;;) {
    const b = buf[i++];
    result |= BigInt(b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7n;
  }
  return [Number(result), i];
}

/** A number field's value as the feed can actually mean it.
 *
 *  Protobuf writes a negative int32/int64 as a full 10-byte varint, so the
 *  feed's `-1` sentinel ("no such value") travels as the wire value 2^64-1 —
 *  and an unsigned read turns that into `18446744073709552000`. Nothing this
 *  app draws is anywhere near that: ids, kickoff clocks, goal counts, points
 *  and capacities all sit far inside `Number.MAX_SAFE_INTEGER`. A value outside
 *  the safe, non-negative range is therefore that sign extension, not a number
 *  the feed could have meant, and reads as `undefined` — which is exactly what
 *  omitting the field means (the sentinel's own magnitude is lost on the way
 *  through `Number`, and no caller here needs it).
 *
 *  Non-integers cannot reach a wire-0 field, so `Number.isSafeInteger` is the
 *  whole test; wire-5 (float) fields are skipped by {@link iterFields}. See
 *  `decodeTeamStanding` for the standings row this was written for. */
export function numberValue(value: number | Uint8Array): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

export function* iterFields(buf: Uint8Array): Generator<Field, void, undefined> {
  let pos = 0;
  while (pos < buf.length) {
    const [tag, p1] = readVarint(buf, pos);
    const field = tag >> 3;
    const wire = tag & 7;
    pos = p1;
    if (wire === 0) {
      const [v, p2] = readVarint(buf, pos);
      pos = p2;
      yield { field, wire, value: v };
    } else if (wire === 2) {
      const [len, p2] = readVarint(buf, pos);
      pos = p2 + len;
      yield { field, wire, value: buf.subarray(p2, pos) };
    } else if (wire === 5) {
      pos += 4;
    } else if (wire === 1) {
      pos += 8;
    } else {
      return; // unknown wire type — stop to avoid an infinite loop
    }
  }
}

/** {@link iterFields} WITHOUT the wire-5 skip: a float comes through as a
 *  number (and a wire-1 double is read as one too). The plain walker drops them
 *  because every other decoder in the app reads integer/string fields only, so
 *  it never has to decide what a float means. The momentum trend is the one
 *  payload whose payload IS floats, so it walks with this instead.
 *  Unknown wire types still stop the walk — same safety valve as above. */
export function* iterFieldsAll(buf: Uint8Array): Generator<Field, void, undefined> {
  let pos = 0;
  while (pos < buf.length) {
    const [tag, p1] = readVarint(buf, pos);
    const field = tag >> 3;
    const wire = tag & 7;
    pos = p1;
    if (wire === 0) {
      const [v, p2] = readVarint(buf, pos);
      pos = p2;
      yield { field, wire, value: v };
    } else if (wire === 2) {
      const [len, p2] = readVarint(buf, pos);
      pos = p2 + len;
      yield { field, wire, value: buf.subarray(p2, pos) };
    } else if (wire === 5) {
      if (pos + 4 > buf.length) return; // truncated — stop rather than throw
      const v = new DataView(buf.buffer, buf.byteOffset + pos, 4).getFloat32(0, true);
      pos += 4;
      yield { field, wire, value: v };
    } else if (wire === 1) {
      if (pos + 8 > buf.length) return;
      const v = new DataView(buf.buffer, buf.byteOffset + pos, 8).getFloat64(0, true);
      pos += 8;
      yield { field, wire, value: v };
    } else {
      return; // unknown wire type — stop to avoid an infinite loop
    }
  }
}


const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += b64chars[b0 >> 2];
    out += b64chars[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? b64chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? b64chars[b2 & 63] : '=';
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, '');
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = b64chars.indexOf(ch);
    if (v < 0) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

const textDecoder = new TextDecoder('utf-8', { fatal: false });

export function parsePBResponse(buf: Uint8Array): PBResponse {
  const out: PBResponse = {};
  for (const f of iterFields(buf)) {
    if (f.field === 1 && f.wire === 2) out.requestToken = textDecoder.decode(f.value as Uint8Array);
    else if (f.field === 2) out.code = f.value as number;
    else if (f.field === 3 && f.wire === 2) out.message = textDecoder.decode(f.value as Uint8Array);
    else if (f.field === 4 && f.wire === 2) out.magic = textDecoder.decode(f.value as Uint8Array);
    else if (f.field === 10 && f.wire === 2) out.data = f.value as Uint8Array;
  }
  return out;
}

export function parseMagicOffset(magicB64?: string): number {
  if (!magicB64) return 0;
  try {
    const magic = base64ToBytes(magicB64);
    for (const f of iterFields(magic)) {
      if (f.field !== 2) continue;
      for (const p of iterFields(f.value as Uint8Array)) {
        if (p.field === 10) return p.value as number;
      }
    }
  } catch {
    /* ignore */
  }
  return 0;
}

export function extractPayload(pb: PBResponse): Uint8Array {
  if (!pb.data) return new Uint8Array();
  const offset = parseMagicOffset(pb.magic);
  return pb.data.subarray(Math.min(offset, pb.data.length));
}

export function parseBodySignatures(payload: Uint8Array): Record<number, string> {
  const map: Record<number, string> = {};
  for (const f of iterFields(payload)) {
    if (f.field !== 1) continue;
    let key: number | undefined;
    let val: string | undefined;
    for (const e of iterFields(f.value as Uint8Array)) {
      if (e.field === 1) key = e.value as number;
      else if (e.field === 2) val = textDecoder.decode(e.value as Uint8Array);
    }
    if (key !== undefined && val !== undefined) map[key] = val;
  }
  return map;
}

/** ROT47 — used to encode/decode /api/common/params text responses. */
export function rot47(s: string): string {
  return s.replace(/[!-~]/g, (ch) => String.fromCharCode(33 + ((ch.charCodeAt(0) - 33 + 47) % 94)));
}
