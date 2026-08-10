import { Buffer } from "node:buffer";

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;
const MAX_ZIP_COMMENT_BYTES = 65_535;
const FIXED_DOS_TIME = 0;
const FIXED_DOS_DATE = 0x21; // 1980-01-01
const FIXED_UNIX_SECONDS = 315_532_800;
const FIXED_NTFS_FILETIME = 119_600_064_000_000_000n;

/**
 * WXT emits stable file contents and ordering, but ZIP headers inherit build
 * time. Normalize every timestamp-bearing header and known timestamp extra
 * field so identical extension contents produce identical release bytes.
 *
 * @param {Buffer} source
 * @returns {Buffer}
 */
export function normalizeZipArchive(source) {
  const archive = Buffer.from(source);
  const endOffset = findEndOfCentralDirectory(archive);
  const diskNumber = archive.readUInt16LE(endOffset + 4);
  const centralDisk = archive.readUInt16LE(endOffset + 6);
  const entriesOnDisk = archive.readUInt16LE(endOffset + 8);
  const entries = archive.readUInt16LE(endOffset + 10);
  const centralOffset = archive.readUInt32LE(endOffset + 16);

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entries) {
    throw new Error("Multi-disk ZIP archives are not supported.");
  }
  if (entries === ZIP64_SENTINEL_16 || centralOffset === ZIP64_SENTINEL_32) {
    throw new Error(
      "ZIP64 archives are not supported by the release packager.",
    );
  }

  let offset = centralOffset;
  for (let index = 0; index < entries; index += 1) {
    assertSignature(archive, offset, CENTRAL_DIRECTORY_HEADER, "central");
    archive.writeUInt16LE(FIXED_DOS_TIME, offset + 12);
    archive.writeUInt16LE(FIXED_DOS_DATE, offset + 14);

    const fileNameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    if (localOffset === ZIP64_SENTINEL_32) {
      throw new Error("ZIP64 local offsets are not supported.");
    }

    normalizeExtraFields(archive, offset + 46 + fileNameLength, extraLength);
    normalizeLocalHeader(archive, localOffset);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return archive;
}

/** @param {Buffer} archive @param {number} localOffset */
function normalizeLocalHeader(archive, localOffset) {
  assertSignature(archive, localOffset, LOCAL_FILE_HEADER, "local");
  archive.writeUInt16LE(FIXED_DOS_TIME, localOffset + 10);
  archive.writeUInt16LE(FIXED_DOS_DATE, localOffset + 12);
  const fileNameLength = archive.readUInt16LE(localOffset + 26);
  const extraLength = archive.readUInt16LE(localOffset + 28);
  normalizeExtraFields(archive, localOffset + 30 + fileNameLength, extraLength);
}

/**
 * @param {Buffer} archive
 * @param {number} offset
 * @param {number} length
 */
function normalizeExtraFields(archive, offset, length) {
  const end = offset + length;
  if (end > archive.length) throw new Error("Invalid ZIP extra-field length.");

  while (offset < end) {
    if (offset + 4 > end) throw new Error("Truncated ZIP extra-field header.");
    const id = archive.readUInt16LE(offset);
    const size = archive.readUInt16LE(offset + 2);
    const dataOffset = offset + 4;
    const dataEnd = dataOffset + size;
    if (dataEnd > end) throw new Error("Truncated ZIP extra-field body.");

    if (id === 0x5455) {
      normalizeExtendedTimestamp(archive, dataOffset, dataEnd);
    } else if (id === 0x000a) {
      normalizeNtfsTimestamp(archive, dataOffset, dataEnd);
    } else if ((id === 0x000d || id === 0x5855) && size >= 8) {
      archive.writeUInt32LE(FIXED_UNIX_SECONDS, dataOffset);
      archive.writeUInt32LE(FIXED_UNIX_SECONDS, dataOffset + 4);
    }
    offset = dataEnd;
  }
}

/**
 * @param {Buffer} archive
 * @param {number} offset
 * @param {number} end
 */
function normalizeExtendedTimestamp(archive, offset, end) {
  if (offset >= end) return;
  const flags = archive[offset] ?? 0;
  offset += 1;
  for (const flag of [1, 2, 4]) {
    if ((flags & flag) === 0) continue;
    if (offset + 4 > end) throw new Error("Truncated extended ZIP timestamp.");
    archive.writeUInt32LE(FIXED_UNIX_SECONDS, offset);
    offset += 4;
  }
}

/**
 * @param {Buffer} archive
 * @param {number} offset
 * @param {number} end
 */
function normalizeNtfsTimestamp(archive, offset, end) {
  offset += 4; // reserved
  while (offset + 4 <= end) {
    const tag = archive.readUInt16LE(offset);
    const size = archive.readUInt16LE(offset + 2);
    const dataOffset = offset + 4;
    const dataEnd = dataOffset + size;
    if (dataEnd > end) throw new Error("Truncated NTFS ZIP extra field.");
    if (tag === 1 && size >= 24) {
      archive.writeBigUInt64LE(FIXED_NTFS_FILETIME, dataOffset);
      archive.writeBigUInt64LE(FIXED_NTFS_FILETIME, dataOffset + 8);
      archive.writeBigUInt64LE(FIXED_NTFS_FILETIME, dataOffset + 16);
    }
    offset = dataEnd;
  }
}

/** @param {Buffer} archive @returns {number} */
function findEndOfCentralDirectory(archive) {
  const earliest = Math.max(0, archive.length - MAX_ZIP_COMMENT_BYTES - 22);
  for (let offset = archive.length - 22; offset >= earliest; offset -= 1) {
    if (archive.readUInt32LE(offset) !== END_OF_CENTRAL_DIRECTORY) continue;
    const commentLength = archive.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === archive.length) return offset;
  }
  throw new Error("ZIP end-of-central-directory record was not found.");
}

/**
 * @param {Buffer} archive
 * @param {number} offset
 * @param {number} expected
 * @param {string} label
 */
function assertSignature(archive, offset, expected, label) {
  if (offset < 0 || offset + 4 > archive.length) {
    throw new Error(`Invalid ${label} ZIP header offset.`);
  }
  if (archive.readUInt32LE(offset) !== expected) {
    throw new Error(`Invalid ${label} ZIP header signature.`);
  }
}
