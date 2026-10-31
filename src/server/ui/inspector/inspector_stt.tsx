import { STT_Backends, STT_State } from "@/server/services/stt/schema";
import { ServiceNetworkState } from "@/types";
import { invoke } from "@tauri-apps/api/tauri";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { FC, useEffect, useState } from "react";
import { RiCharacterRecognitionFill, RiUserVoiceFill } from "react-icons/ri";
import { SiGooglechrome, SiMicrosoftedge } from "react-icons/si";
import { useSnapshot } from "valtio";
import { azureLanguages, deepGramLangs, nativeLangs } from "../../services/stt/stt_data";
import { WHISPER_LANGUAGES, WHISPER_MODELS, whisperModelById, whisperLanguagesForModel, whisperSupportsTranslation } from "../../services/stt/whisper_models";
import ServiceButton from "../service-button";
import Inspector from "./components";
import { InputCheckbox, InputMapObject, InputMappedGroupSelect, InputSelect, InputText, InputWebAudioInput } from "./components/input";
import NiceModal from "@ebay/nice-modal-react";
import Modal from "../Modal";
import { useTranslation } from 'react-i18next';

type WhisperProgress = {
  model: string;
  phase: string;
  received: number;
  total: number;
  done: boolean;
  message: string;
};

const Native: FC = () => {
  const {t} = useTranslation();
  const pr = useSnapshot(window.ApiServer.state.services.stt.data.native);
  const updateLanguage = (value: { group: string, option: string }) => {
    window.ApiServer.state.services.stt.data.native.language       = value.option;
    window.ApiServer.state.services.stt.data.native.language_group = value.group;
  };
  return <>
    <Inspector.SubHeader>{t('stt.native_title')}</Inspector.SubHeader>
    <InputMappedGroupSelect
      labelGroup="common.field_language"
      labelOption="common.field_dialect"
      value={{ option: pr.language, group: pr.language_group }}
      onChange={updateLanguage}
      library={nativeLangs} />
    {/* <div className="p-2 border-2 border-error rounded-lg text-xs space-y-2 flex flex-col">
      <span className="font-bold text-error">Experimental. Might be unstable on some PCs.</span>
      <span className="font-bold text-error">Auto start is disabled.</span>
      <span className="font-bold">How to test</span>
      Just keep it on in the background for 10-15 minutes and say something every minute or two.</div> */}
  </>
}

const Browser: FC = () => {
  const {t} = useTranslation();
  const handleOpen = () => {
    invoke("plugin:web|open_browser", {
      data: {
        browser: "chrome",
        url: `http://localhost:${window.Config.serverNetwork.port}/mic.html?device=${encodeURIComponent(window.ApiServer.state.services.stt.data.inputDevice || "default")}`
      }
    });
  };

  const handleOpenEdge = () => {
    invoke("plugin:web|open_browser", {
      data: {
        browser: "msedge",
        url: `http://localhost:${window.Config.serverNetwork.port}/mic.html?device=${encodeURIComponent(window.ApiServer.state.services.stt.data.inputDevice || "default")}`
      }
    });
  };

  const handleStartStt = () => {
    invoke("plugin:windows_stt|start");
  };
  return <>
    <Inspector.SubHeader>{t('stt.browser_title')}</Inspector.SubHeader>
    <button className="btn btn-sm btn-neutral gap-2" onClick={handleOpen}><SiGooglechrome/> Open Chrome</button>
    <button className="btn btn-sm btn-neutral gap-2" onClick={handleOpenEdge}><SiMicrosoftedge/> Open Edge</button>
  </>
}


const Azure: FC = () => {
  const {t} = useTranslation();
  const pr = useSnapshot(window.ApiServer.state.services.stt.data.azure);
  const up = <K extends keyof STT_State["azure"]>(key: K, v: STT_State["azure"][K]) => window.ApiServer.state.services.stt.data.azure[key] = v;

  const updateLanguage = (value: { group: string, option: string }) => {
    window.ApiServer.state.services.stt.data.azure.language       = value.option;
    window.ApiServer.state.services.stt.data.azure.language_group = value.group;
  };

  const updateSecondaryLanguage = (value: { group: string, option: string }) => {
    window.ApiServer.state.services.stt.data.azure.secondary_language       = value.option;
    window.ApiServer.state.services.stt.data.azure.secondary_language_group = value.group;
  };

  return <>
    <Inspector.SubHeader>{t('stt.azure_title')}</Inspector.SubHeader>
    <InputText label="stt.azure_key" type="password" value={pr.key} onChange={e => up("key", e.target.value)} />
    <InputText label="stt.azure_location" value={pr.location} onChange={e => up("location", e.target.value)} />

    <div className=" divider"></div>
    <InputMappedGroupSelect
      labelGroup="common.field_language"
      labelOption="common.field_dialect"
      value={{ option: pr.language, group: pr.language_group }}
      onChange={updateLanguage}
      library={azureLanguages} />
    <InputCheckbox label="stt.azure_use_secondary_language" onChange={e => up("use_secondary_language", e)} value={pr.use_secondary_language} />
    <Inspector.Switchable visible={pr.use_secondary_language}>
      <InputMappedGroupSelect
        labelGroup="stt.azure_secondary_language"
        labelOption="common.field_dialect"
        value={{ option: pr.secondary_language, group: pr.secondary_language_group }}
        onChange={updateSecondaryLanguage}
        library={azureLanguages} />
    </Inspector.Switchable>

    <InputSelect 
      label="stt.azure_profanity"
      options={[
        { label: t('stt.azure_profanity_masked'), value: 'masked' },
        { label: t('stt.azure_profanity_removed'), value: 'removed' },
        { label: t('stt.azure_profanity_raw'), value: 'raw' },
      ]}
      value={pr.profanity}
      onValueChange={e => up("profanity", e)}
    />
    <InputText type="number" step="1" label="stt.azure_silence_timeout" value={pr.silenceTimeout} onChange={e => up("silenceTimeout", e.target.value)} />
    <InputCheckbox label="stt.field_enable_interim_results" onChange={e => up("interim", e)} value={pr.interim} />
  </>
}

const Deepgram: FC = () => {
  const {t} = useTranslation();
  const pr = useSnapshot(window.ApiServer.state.services.stt.data.deepgram);
  const up = <K extends keyof STT_State["deepgram"]>(key: K, v: STT_State["deepgram"][K]) => window.ApiServer.state.services.stt.data.deepgram[key] = v;

  const updateLanguage = (value: { group: string, option: string }) => {
    window.ApiServer.state.services.stt.data.deepgram.language       = value.option;
    window.ApiServer.state.services.stt.data.deepgram.language_group = value.group;
  };

  return <>
    <Inspector.SubHeader>{t('stt.deepgram_title')}</Inspector.SubHeader>
    <InputText label="stt.deepgram_key" type="password" value={pr.key} onChange={e => up("key", e.target.value)} />

    <InputMappedGroupSelect
      labelGroup="common.field_language"
      labelOption="common.field_dialect"
      value={{ option: pr.language, group: pr.language_group }}
      onChange={updateLanguage}
      library={deepGramLangs} />

    <InputSelect options={[
      { label: 'Base', value: 'base' },
      { label: 'Enhanced', value: 'enhanced' },
    ]} label="stt.deepgram_quality" value={pr.tier} onValueChange={e => up("tier", e)} />

    <span className="text-base-content/60 text-xs">
      {t('stt.deepgram_quality_notice')}
      <br />
      <a className="link link-primary link-hover" target="_blank" href="https://developers.deepgram.com/documentation/features/language/#language-options">{t('stt.deepgram_quality_notice_link')}</a>
    </span>

    <InputCheckbox label="stt.field_enable_interim_results" onChange={e => up("interim", e)} value={pr.interim} />
    <InputCheckbox label="stt.deepgram_profanity" onChange={e => up("profanity", e)} value={pr.profanity} />
    <InputCheckbox label="stt.deepgram_punctuate" onChange={e => up("punctuate", e)} value={pr.punctuate} />
  </>
}

const Speechly: FC = () => {
  const {t} = useTranslation();
  const pr = useSnapshot(window.ApiServer.state.services.stt.data.speechly);
  const up = <K extends keyof STT_State["speechly"]>(key: K, v: STT_State["speechly"][K]) => window.ApiServer.state.services.stt.data.speechly[key] = v;

  return <>
    <Inspector.SubHeader>{t('stt.speechly_title')}</Inspector.SubHeader>
    <InputText label="stt.speechly_appid" type="password" value={pr.key} onChange={e => up("key", e.target.value)} />
  </>
}

const formatBytes = (value: number) => {
  if (!value) return "";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} GB`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)} MB`;
  return `${Math.round(value / 1000)} KB`;
};

const Whisper: FC = () => {
  const {t} = useTranslation();
  const pr = useSnapshot(window.ApiServer.state.services.stt.data.whisper);
  const up = <K extends keyof STT_State["whisper"]>(key: K, v: STT_State["whisper"][K]) => window.ApiServer.state.services.stt.data.whisper[key] = v;
  const model = whisperModelById(pr.model);
  const runtime = useSnapshot(window.ApiServer.stt.serviceState);
  const [progress, setProgress] = useState<WhisperProgress | null>(null);
  const [modelsDir, setModelsDir] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancel = false;
    if (!window.Config.isApp()) {
      setModelsDir("Models (saved next to the Curses program)");
      if (pr.model === "tiny") {
        setReady(true);
        setError("");
      } else {
        setReady(false);
        setError("This preview can try Tiny. Other models download in the desktop app, into the Models folder next to Curses.");
      }
      return;
    }
    invoke<string>("plugin:whisper|models_dir").then(setModelsDir).catch(() => {});
    listen<WhisperProgress>("whisper-download", (event) => {
      if (event.payload.model === "runtime" || event.payload.model === window.ApiServer.state.services.stt.data.whisper.model)
        setProgress(event.payload);
    }).then(fn => {
      if (cancel) fn();
      else unlisten = fn;
    });
    setError("");
    setReady(false);
    setProgress(null);
    invoke("plugin:whisper|download_model", { model: pr.model })
      .then(() => { if (!cancel) setReady(true); })
      .catch((err: unknown) => {
        if (cancel) return;
        const message = typeof err === "string" ? err : err instanceof Error ? err.message : "Download failed";
        setError(message);
      });
    return () => {
      cancel = true;
      unlisten?.();
    };
  }, [pr.model]);

  const pct = progress && progress.total > 0 ? Math.min(100, Math.round((progress.received / progress.total) * 100)) : 0;

  return <>
    <Inspector.SubHeader>{t('stt.whisper_title')}</Inspector.SubHeader>
    <Inspector.Description>{t('stt.whisper_offline')}</Inspector.Description>
    <InputSelect label="Whisper processing device" value={pr.acceleration} options={[
      { label: "Automatic (NVIDIA CUDA on Windows)", value: "auto" },
      { label: "NVIDIA GPU (CUDA)", value: "cuda" },
      { label: "CPU", value: "cpu" },
    ]} onValueChange={value => up("acceleration", value as STT_State["whisper"]["acceleration"])} />
    {pr.acceleration !== "cpu" && <InputText label="CUDA GPU index" type="number" min="0" max="31" step="1"
      value={pr.gpuDevice} onChange={e => {
        const value = Number(e.target.value);
        if (Number.isInteger(value) && value >= 0 && value <= 31) up("gpuDevice", value);
      }} />}
    <Inspector.Description>CUDA accelerates both transcription and Translation. The first GPU start downloads the CUDA runtime once (about 685 MB). Models are reused. If GPU initialization fails, select CPU explicitly or check the NVIDIA driver and server log.</Inspector.Description>
    <Inspector.Description>{runtime.whisperDevice || "Processing device will be verified when Whisper starts."}</Inspector.Description>
    <InputSelect
      label="stt.whisper_language"
      options={model.english ? [{ label: "English", value: "en" }] : whisperLanguagesForModel(pr.model)}
      value={model.english ? "en" : pr.language}
      onValueChange={e => up("language", e)}
    />
    {whisperSupportsTranslation(pr.model) && <InputCheckbox label="stt.whisper_translate" value={pr.translate} onChange={e => up("translate", e)} />}
    <InputCheckbox label="stt.field_enable_interim_results" onChange={e => up("interim", e)} value={pr.interim} />
    <InputText type="number" step="0.1" min="0.3" label="stt.whisper_silence" value={pr.silenceTimeout} onChange={e => up("silenceTimeout", e.target.value)} />
    {progress && !progress.done && (progress.model === "runtime" || !ready) && <div className="space-y-1">
      <progress className="progress progress-primary w-full" value={pct} max={100}></progress>
      <span className="text-xs text-base-content/70">{progress.message || t('stt.whisper_downloading')} {pct ? `${pct}%` : ""} {progress.total ? `(${formatBytes(progress.received)} / ${formatBytes(progress.total)})` : ""}</span>
    </div>}
    {ready && !error && <span className="text-xs text-success">{t('stt.whisper_ready', { model: model.label })}</span>}
    {error && <span className="text-xs text-error">{error}</span>}
    {modelsDir && <Inspector.Description>{t('stt.whisper_folder', { path: modelsDir })}</Inspector.Description>}
  </>
}

const WordsReplacementModal: FC = () => {
  const {t} = useTranslation();
  const data = useSnapshot(window.ApiServer.state.services.stt);

  const up = <K extends keyof STT_State>(key: K, v: STT_State[K]) => window.ApiServer.patchService("stt", s => s.data[key] = v);

  return <Modal.Body width={420}>
    <Modal.Header>{t('word_replacements.title')}</Modal.Header>
    <Modal.Content>
      <div className="p-4 flex flex-col space-y-2">
        <InputCheckbox label="word_replacements.field_ignore_case" value={data.data.replaceWordsIgnoreCase} onChange={v => up("replaceWordsIgnoreCase", v)}/>
        {data.data.replaceWordsIgnoreCase && <>
          <InputCheckbox label="word_replacements.field_preserve_capitalization" value={data.data.replaceWordsPreserveCase} onChange={v => up("replaceWordsPreserveCase", v)}/>
          <Inspector.Description>{t('word_replacements.field_preserve_capitalization_desc')}</Inspector.Description>
        </>}
        <InputMapObject keyPlaceholder={t('word_replacements.label_dictionary_key')} valuePlaceholder={t('word_replacements.label_dictionary_value')} addLabel={t('common.btn_add')} value={{...data.data.replaceWords}} onChange={e => up("replaceWords", e)} label="" />
      </div>
    </Modal.Content>
  </Modal.Body>
}
NiceModal.register('stt-replacements', (props) => <Modal.Base {...props}><WordsReplacementModal /></Modal.Base>);

const Inspector_STT: FC = () => {
  const {t} = useTranslation();
  const data = useSnapshot(window.ApiServer.state.services.stt);
  const state = useSnapshot(window.ApiServer.stt.serviceState);

  const handleStart = (v: boolean) => window.ApiServer.state.services.stt.showActionButton = v;
  const up = <K extends keyof STT_State>(key: K, v: STT_State[K]) => window.ApiServer.patchService("stt", s => s.data[key] = v);

  const handleShowReplacements = () => {
    NiceModal.show('stt-replacements');
  }

  return <Inspector.Body>
    <Inspector.Header><RiUserVoiceFill /> {t('stt.title')}</Inspector.Header>
    <Inspector.Content>
      <InputCheckbox label="common.field_action_bar" onChange={handleStart} value={data.showActionButton} />
      <InputCheckbox label="common.field_auto_start" value={data.data.autoStart} onChange={e => up("autoStart", e)} />
      <InputCheckbox label="stt.field_stop_with_stream" value={data.data.stopWithStream} onChange={e => up("stopWithStream", e)} />
      <span className="link link-accent link-hover font-semibold flex items-center gap-2 text-sm" onClick={handleShowReplacements}><RiCharacterRecognitionFill/>{t('common.btn_edit_replacements')}</span>
      <InputWebAudioInput value={data.data.inputDevice} onChange={device => {
        up("inputDevice", device);
        if (state.status !== ServiceNetworkState.disconnected) {
          window.ApiServer.stt.stop();
          window.setTimeout(() => window.ApiServer.stt.start(), 250);
        }
      }} label="stt.field_microphone"/>
      <Inspector.Description>{t('stt.field_microphone_desc')}</Inspector.Description>
      <Inspector.Deactivatable active={state.status === ServiceNetworkState.disconnected}>
        <InputSelect options={[
          { label: "Native", value: STT_Backends.native },
          { label: "Browser", value: STT_Backends.browser },
          { label: "Azure", value: STT_Backends.azure },
          { label: "Deepgram", value: STT_Backends.deepgram },
          { label: "Speechly", value: STT_Backends.speechly },
          {
            label: "OpenAI Whisper",
            options: WHISPER_MODELS.map(model => ({
              label: `Whisper ${model.label} · ${model.size}`,
              value: `whisper:${model.id}`,
            })),
          },
        ]} label="common.field_service" value={data.data.backend === STT_Backends.whisper ? `whisper:${data.data.whisper.model}` : data.data.backend} onValueChange={value => {
          if (value.startsWith("whisper:")) {
            const model = value.slice("whisper:".length);
            window.ApiServer.patchService("stt", s => {
              s.data.backend = STT_Backends.whisper;
              s.data.whisper.model = model;
            });
          } else {
            up("backend", value as STT_Backends);
          }
        }} />

        {data.data.backend === STT_Backends.browser && <Browser />}
        {data.data.backend === STT_Backends.azure && <Azure />}
        {data.data.backend === STT_Backends.deepgram && <Deepgram />}
        {data.data.backend === STT_Backends.speechly && <Speechly />}
        {data.data.backend === STT_Backends.native && <Native />}
        {data.data.backend === STT_Backends.whisper && <Whisper />}
      </Inspector.Deactivatable>

      {data.data.backend !== STT_Backends.browser && <ServiceButton status={state.status} onStart={() => window.ApiServer.stt.start()} onStop={() => window.ApiServer.stt.stop()} />}
      <div className="pt-8">
        <InputCheckbox label='stt.field_uwu_filter' onChange={e => up("uwu", e)} value={data.data.uwu} />
        <Inspector.Description>{t('stt.field_uwu_filter_desc')}</Inspector.Description>
      </div>
    </Inspector.Content>
  </Inspector.Body>
}

export default Inspector_STT;
