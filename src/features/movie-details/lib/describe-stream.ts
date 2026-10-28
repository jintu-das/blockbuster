import { languageLabel } from "@/features/library";
import type { EmbeddedSubtitle } from "@/features/subtitles";
import type { MediaStream } from "../types";

const codecNames: Record<string, string> = {
  hevc: "HEVC",
  h264: "H.264",
  av1: "AV1",
  vp9: "VP9",
  mpeg4: "MPEG-4",
  mpeg2video: "MPEG-2",
  truehd: "Dolby TrueHD",
  eac3: "Dolby Digital Plus",
  ac3: "Dolby Digital",
  dts: "DTS",
  aac: "AAC",
  flac: "FLAC",
  opus: "Opus",
  vorbis: "Vorbis",
  mp3: "MP3",
  pcm_s16le: "PCM",
  pcm_s24le: "PCM",
  hdmv_pgs_subtitle: "PGS",
  subrip: "SubRip",
  ass: "ASS",
  mov_text: "Timed text",
  dvd_subtitle: "VobSub",
  webvtt: "WebVTT",
};

/** "HEVC" for "hevc"; unknown codecs in upper case. */
function codecName(codec: string) {
  return codecNames[codec] ?? codec.toUpperCase();
}

/** "HEVC (Main 10)", "DTS (DTS-HD MA)", "PGS". */
export function codecLabel(stream: MediaStream) {
  const name = codecName(stream.codec);
  return stream.profile && stream.kind !== "subtitle" ? `${name} (${stream.profile})` : name;
}

/** "7.1", "5.1", "Stereo"; ffprobe adds speaker hints like "5.1(side)" that people don't need. */
function channelLabel(stream: MediaStream) {
  const layout = stream.channelLayout?.replace(/\(.*\)$/, "");
  if (layout === "stereo") return "Stereo";
  if (layout === "mono") return "Mono";
  return layout ?? (stream.channels !== null ? `${stream.channels} ch` : undefined);
}

/** One line of technical detail, e.g. "3840x1600 @ 23.976 fps • HDR" or "7.1 • 48 kHz • 640 kb/s". */
export function streamSummary(stream: MediaStream) {
  const parts =
    stream.kind === "video"
      ? [
          stream.width && stream.height && `${stream.width}x${stream.height}`,
          stream.fps && `${stream.fps} fps`,
          stream.hdr && "HDR",
        ]
      : stream.kind === "audio"
        ? [
            channelLabel(stream),
            stream.sampleRate && `${stream.sampleRate / 1000} kHz`,
            stream.bitrateKbps && `${stream.bitrateKbps} kb/s`,
          ]
        : [stream.title ?? "Embedded"];
  const language = stream.language && languageLabel(stream.language);
  const title = stream.kind !== "subtitle" && stream.title;
  return [...parts, language, title].filter(Boolean).join(" • ");
}

/** Short label of the audio track mpv plays (the default one, else the first), e.g. "Dolby TrueHD 7.1". */
export function audioLabel(streams: MediaStream[]) {
  const tracks = streams.filter((stream) => stream.kind === "audio");
  const audio = tracks.find((stream) => stream.default) ?? tracks[0];
  if (!audio) return undefined;
  return [codecName(audio.codec), channelLabel(audio)].filter(Boolean).join(" ");
}

export function formatBitrate(kbps: number) {
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kb/s`;
}

/** The video's subtitle streams, numbered as mpv numbers them, for the subtitles card. */
export function embeddedSubtitles(streams: MediaStream[]): EmbeddedSubtitle[] {
  return streams
    .filter((stream) => stream.kind === "subtitle")
    .map((stream, position) => ({
      index: position + 1,
      label: stream.language ? languageLabel(stream.language) : (stream.title ?? `Track ${position + 1}`),
      detail: [codecLabel(stream), stream.language && stream.title].filter(Boolean).join(" • "),
      isDefault: stream.default,
    }));
}
