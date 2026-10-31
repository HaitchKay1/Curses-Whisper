import { Translation_Backends, Translation_State } from "@/server/services/translation/schema";
import { ServiceNetworkState } from "@/types";
import { FC, memo } from "react";
import { RiTranslate2 } from "react-icons/ri";
import { useSnapshot } from "valtio";
import ServiceButton from "../service-button";
import Inspector from "./components";
import { InputCheckbox, InputSelect, InputSelectOption, InputText } from "./components/input";
import { useTranslation } from "react-i18next";
import { whisperModelById, whisperTranslationError, whisperLanguagesForModel } from "@/server/services/stt/whisper_models";
import { STT_Backends } from "@/server/services/stt/schema";

const Whisper: FC = () => {
  const {t} = useTranslation();
  const stt = useSnapshot(window.ApiServer.state.services.stt.data);
  const sttStatus = useSnapshot(window.ApiServer.stt.serviceState);
  const translationStatus = useSnapshot(window.ApiServer.translation.serviceState);
  const options = useSnapshot(window.ApiServer.state.services.translation.data.whisper);
  const error = stt.backend !== STT_Backends.whisper
    ? t('transl.whisper_select_stt')
    : whisperTranslationError(stt.whisper.model, options.language);
  return <>
    <Inspector.SubHeader>OpenAI Whisper → English</Inspector.SubHeader>
    <Inspector.Description>{sttStatus.whisperDevice || "Uses the processing device selected in Speech to Text."}</Inspector.Description>
    <Inspector.Description>{t('transl.whisper_description')}</Inspector.Description>
    <Inspector.Description>{t('transl.whisper_model', { model: whisperModelById(stt.whisper.model).label })}</Inspector.Description>
    <InputSelect label="Spoken language → English" value={options.language}
      options={whisperLanguagesForModel(stt.whisper.model)}
      onValueChange={language => { window.ApiServer.state.services.translation.data.whisper.language = language; }} />
    <Inspector.Description>Auto detect uses the recorded audio to identify the spoken language independently of Speech to Text settings.</Inspector.Description>
    <Inspector.Description>{translationStatus.whisperProgress}</Inspector.Description>
    {translationStatus.whisperLastResult && <div className="rounded border border-base-content/20 p-2 text-sm select-text">
      <div className="text-xs font-semibold mb-1">Latest English translation</div>
      {translationStatus.whisperLastResult}
    </div>}
    <Inspector.Description>{t('transl.whisper_setup')}</Inspector.Description>
    {error && <span className="text-xs text-error">{error}</span>}
    {!error && sttStatus.status !== ServiceNetworkState.connected &&
      <Inspector.Description>{t('transl.whisper_waiting')}</Inspector.Description>}
    <InputCheckbox label="common.field_interim_results" value={options.interim}
      onChange={value => { window.ApiServer.state.services.translation.data.whisper.interim = value; }} />
    <Inspector.Description>{t('transl.whisper_interim')}</Inspector.Description>
  </>;
};

const Azure: FC = memo(() => {
  const {t} = useTranslation();
  const pr = useSnapshot(window.ApiServer.state.services.translation.data.azure);
  const {azure: azureLanguages} = useSnapshot(window.ApiServer.translation.lib);
  const up = <K extends keyof Translation_State["azure"]>(key: K, v: Translation_State["azure"][K]) => window.ApiServer.state.services.translation.data.azure[key] = v;

  return <>
    <Inspector.SubHeader>{t('transl.azure_title')}</Inspector.SubHeader>
    <InputText label="transl.azure_key" type="password" value={pr.key} onChange={e => up("key", e.target.value)} />
    <InputText label="transl.azure_location" value={pr.location} onChange={e => up("location", e.target.value)} />
    <InputSelect 
      label="transl.azure_from_language"
      options={azureLanguages as InputSelectOption[]}
      value={pr.languageFrom}
      onValueChange={e => up("languageFrom", e as any)}
    />
    <InputSelect 
      label="transl.azure_to_language"
      options={azureLanguages as InputSelectOption[]}
      value={pr.language}
      onValueChange={e => up("language", e as any)}
    />
    <InputSelect 
      label="transl.azure_profanity"
      options={[
        { label: t('transl.azure_profanity_masked'), value: 'Marked' },
        { label: t('transl.azure_profanity_removed'), value: 'Deleted' },
        { label: t('transl.azure_profanity_raw'), value: 'NoAction' },
      ]}
      value={pr.profanity}
      onValueChange={e => up("profanity", e as any)}
    />
    <InputCheckbox label="common.field_interim_results" onChange={e => up("interim", e)} value={pr.interim} />
  </>
})

const Inspector_Translation: FC = () => {
  const {t} = useTranslation();
  const data = useSnapshot(window.ApiServer.state.services.translation);
  const state = useSnapshot(window.ApiServer.translation.serviceState);

  const handleStart = (v: boolean) => window.ApiServer.state.services.translation.showActionButton = v;
  const up = <K extends keyof Translation_State>(key: K, v: Translation_State[K]) => window.ApiServer.patchService("translation", s => s.data[key] = v);

  return <Inspector.Body>
    <Inspector.Header><RiTranslate2 /> {t('transl.title')}</Inspector.Header>
    <Inspector.Content>
      <InputCheckbox label="common.field_action_bar" onChange={handleStart} value={data.showActionButton} />
      <InputCheckbox label="common.field_auto_start" value={data.data.autoStart} onChange={e => up("autoStart", e)} />
      <Inspector.Deactivatable active={state.status === ServiceNetworkState.disconnected}>
        <InputSelect options={[
          { label: "Azure", value: Translation_Backends.azure },
          { label: "OpenAI Whisper → English (offline)", value: Translation_Backends.whisper },
        ]} label="common.field_service" value={data.data.backend} onValueChange={e => up("backend", e as Translation_Backends)} />

        {data.data.backend === Translation_Backends.azure && <Azure />}
        {data.data.backend === Translation_Backends.whisper && <Whisper />}
      </Inspector.Deactivatable>

      <ServiceButton status={state.status} onStart={() => window.ApiServer.translation.start()} onStop={() => window.ApiServer.translation.stop()} />
    </Inspector.Content>
  </Inspector.Body>
};

export default Inspector_Translation;
