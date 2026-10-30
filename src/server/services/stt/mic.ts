/** Constraints for the microphone chosen in Speech to text. "default" is the OS default input. */
export function microphoneConstraints(device: string | undefined | null): MediaStreamConstraints {
  const audio: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  };
  if (device && device !== "default") {
    audio.deviceId = { exact: device };
  }
  return { audio };
}
