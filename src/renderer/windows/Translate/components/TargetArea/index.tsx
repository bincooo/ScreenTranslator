import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Button,
  ButtonGroup,
  Spinner,
  Tooltip,
} from '@heroui/react'
import { BiCollapseVertical, BiExpandVertical } from 'react-icons/bi'
import { sendNotification } from '@/renderer/lib/electron/notification'
import { useCallback, useEffect, useState, useRef } from 'react'
import { writeClipboardText } from '@/renderer/lib/electron/clipboard'
import { TbTransformFilled } from 'react-icons/tb'
import { HiOutlineVolumeUp } from 'react-icons/hi'
import { MdArticle, MdCode, MdContentCopy } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { GiCycle } from 'react-icons/gi'
import { useAtomValue } from 'jotai'
import { AnimatePresence, motion } from 'framer-motion'

import { MarkdownResult, isMarkdownLike } from './MarkdownResult'
import {
  hasVisibleResult,
  invokeOnce,
  toText,
  toTranslationResult,
  type TranslationResult,
} from './utils'

import { sourceLanguageAtom, targetLanguageAtom } from '../LanguageArea'
import { isAudioData, useConfig, useTtsSpeak } from '../../../../hooks'
import { sourceTextAtom, detectLanguageAtom, manualTranslateFlagAtom } from '../SourceArea'
import * as builtinServices from '@/renderer/providers/translate'
import type { TranslateProvider } from '@/renderer/providers/translate'
import { toErrorMessage } from '@/renderer/providers/shared'
import { reportRuntimeError } from '@/renderer/lib/runtimeError'
import type { EnabledServicePluginList } from '@/renderer/windows/Config/pages/Plugin/installedPlugins'
import { renderSafeRichText } from '@/renderer/components/SafeRichText'
import ServiceInstanceDropdown from '@/renderer/components/ServiceInstanceDropdown'
import {
  invokeTranslateService,
  TranslateServiceInvocationError,
} from '@/renderer/lib/service/invokeTranslateService'
import {
  autoCopyTranslation,
  type TranslationAutoCopyMode,
} from '@/renderer/lib/service/autoCopyTranslation'
import type { ServiceInstanceConfigMap } from '@/renderer/lib/service/serviceConfig'

import { logger } from '@/renderer/lib/logger'
import { whetherPluginService } from '@/renderer/lib/service/service_instance'

const translateID: string[] = []

interface TargetAreaProps {
  index: number
  name: string
  translateServiceInstanceList: string[]
  pluginList: EnabledServicePluginList
  serviceInstanceConfigMap: ServiceInstanceConfigMap
}

const builtinServiceMap: Record<string, TranslateProvider> = builtinServices

export default function TargetArea(props: TargetAreaProps) {
  const { index, name, translateServiceInstanceList, pluginList, serviceInstanceConfigMap } = props

  const [currentTranslateServiceInstanceKey, setCurrentTranslateServiceInstanceKey] = useState(name)
  const [appFontSize] = useConfig('app_font_size', 16)
  const resolvedAppFontSize = appFontSize ?? 16
  const [translateSecondLanguage] = useConfig('translate_second_language', 'en')
  const [isLoading, setIsLoading] = useState(false)
  const [hide, setHide] = useState(true)

  const [result, setResult] = useState<TranslationResult>('')
  const [error, setError] = useState('')
  const [resultViewMode, setResultViewMode] = useState<'markdown' | 'source' | null>(null)

  const sourceText = useAtomValue(sourceTextAtom)
  const manualTranslateFlag = useAtomValue(manualTranslateFlagAtom)
  const sourceLanguage = useAtomValue(sourceLanguageAtom)
  const targetLanguage = useAtomValue(targetLanguageAtom)
  const [autoCopy] = useConfig<TranslationAutoCopyMode>('translate_auto_copy', 'disable')
  const [hideWindow] = useConfig('translate_hide_window', false)
  const [clipboardMonitor] = useConfig('clipboard_monitor', false)

  const detectLanguage = useAtomValue(detectLanguageAtom)
  const effectiveDetectLanguage = sourceLanguage === 'auto' ? detectLanguage : ''
  const { t } = useTranslation()
  const getTranslateServiceNotConfiguredMessage = useCallback(
    () => t('errors.translate_service_not_configured'),
    [t],
  )
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const {
    playAudio,
    serviceInstanceKey: ttsServiceInstanceKey,
    speak: speakText,
  } = useTtsSpeak({
    pluginList,
    serviceInstanceConfigMap,
  })

  useEffect(() => {
    if (error) {
      logger.warn('Translation displayed an error.', {
        service: currentTranslateServiceInstanceKey,
        message: error,
      })
    }
  }, [currentTranslateServiceInstanceKey, error])

  const translate = useCallback(async () => {
    const id = crypto.randomUUID()
    const startedAt = Date.now()
    translateID[index] = id

    const resolvedSourceLanguage = sourceLanguage
    const resolvedTargetLanguage =
      resolvedSourceLanguage === 'auto' && targetLanguage === effectiveDetectLanguage
        ? translateSecondLanguage
        : targetLanguage
    if (resolvedTargetLanguage === null) {
      setError(t('errors.language_not_supported'))
      return
    }
    const providerDetectLanguage =
      resolvedSourceLanguage === 'auto' ? effectiveDetectLanguage || 'auto' : resolvedSourceLanguage
    logger.debug('Translation requested.', {
      service: currentTranslateServiceInstanceKey,
      from: resolvedSourceLanguage,
      to: resolvedTargetLanguage,
      inputLength: sourceText.trim().length,
    })

    setIsLoading(true)
    setHide(true)
    const setHideOnce = invokeOnce(setHide)

    try {
      const value = await invokeTranslateService({
        instanceKey: currentTranslateServiceInstanceKey,
        text: sourceText.trim(),
        from: resolvedSourceLanguage,
        to: resolvedTargetLanguage,
        detect: providerDetectLanguage,
        serviceInstanceConfigMap,
        pluginServices: pluginList.translate,
        builtinServices: builtinServiceMap,
        onStream: (streamValue) => {
          if (translateID[index] !== id) return
          setResult(toTranslationResult(streamValue))
          setHideOnce(false)
        },
      })

      if (translateID[index] !== id) return
      logger.debug('Translation completed.', {
        service: currentTranslateServiceInstanceKey,
        from: resolvedSourceLanguage,
        to: resolvedTargetLanguage,
        inputLength: sourceText.trim().length,
        outputLength: typeof value === 'string' ? value.length : 0,
        durationMs: Date.now() - startedAt,
      })
      setResult(toTranslationResult(typeof value === 'string' ? value.trim() : value))
      setIsLoading(false)
      if (hasVisibleResult(value)) {
        setHideOnce(false)
      }
      if (typeof value === 'string') {
        void autoCopyTranslation({
          mode: autoCopy ?? 'disable',
          targetIndex: index,
          clipboardMonitor: Boolean(clipboardMonitor),
          hideWindow: Boolean(hideWindow),
          sourceText: sourceText.trim(),
          targetText: value,
          writeText: writeClipboardText,
          notify: (text) =>
            sendNotification({
              title: t('common.write_clipboard'),
              body: text,
            }),
        })
      }
    } catch (error) {
      if (translateID[index] !== id) return
      setIsLoading(false)
      setHideOnce(false)
      if (error instanceof TranslateServiceInvocationError) {
        setError(
          error.code === 'language-not-supported'
            ? t('errors.language_not_supported')
            : getTranslateServiceNotConfiguredMessage(),
        )
        return
      }

      const isPlugin = whetherPluginService(currentTranslateServiceInstanceKey)
      reportRuntimeError(error, {
        source: isPlugin ? 'translate.plugin' : 'translate.builtin',
        logMessage: isPlugin ? 'Translation plugin rejected.' : 'Translation provider rejected.',
        toastId: `translate.${isPlugin ? 'plugin' : 'builtin'}:${currentTranslateServiceInstanceKey}`,
        context: {
          service: currentTranslateServiceInstanceKey,
          from: resolvedSourceLanguage,
          to: resolvedTargetLanguage,
          inputLength: sourceText.trim().length,
          durationMs: Date.now() - startedAt,
        },
      })
      setError(toErrorMessage(error))
    }
  }, [
    autoCopy,
    clipboardMonitor,
    currentTranslateServiceInstanceKey,
    effectiveDetectLanguage,
    hideWindow,
    index,
    getTranslateServiceNotConfiguredMessage,
    pluginList,
    serviceInstanceConfigMap,
    sourceLanguage,
    sourceText,
    t,
    targetLanguage,
    translateSecondLanguage,
  ])

  // listen to translation
  useEffect(() => {
    setResult('')
    setError('')
    setResultViewMode(null)
    const canTranslate =
      sourceText.trim() !== '' &&
      sourceLanguage &&
      targetLanguage &&
      autoCopy !== null &&
      hideWindow !== null &&
      clipboardMonitor !== null

    if (!canTranslate) {
      translateID[index] = ''
      setIsLoading(false)
      setHide(true)
      return
    }

    if (autoCopy === 'source' && !clipboardMonitor) {
      writeClipboardText(sourceText).then(() => {
        if (hideWindow) {
          sendNotification({
            title: t('common.write_clipboard'),
            body: sourceText,
          })
        }
      })
    }
    void translate().catch((error) => {
      reportRuntimeError(error, {
        source: 'translate.request',
        logMessage: 'Translation request failed.',
        toastId: `translate.request:${currentTranslateServiceInstanceKey}`,
        context: {
          service: currentTranslateServiceInstanceKey,
        },
      })
      setError(error instanceof Error ? error.toString() : String(error))
      setIsLoading(false)
      setHide(false)
    })
  }, [
    autoCopy,
    clipboardMonitor,
    currentTranslateServiceInstanceKey,
    hideWindow,
    index,
    manualTranslateFlag,
    sourceLanguage,
    sourceText,
    t,
    targetLanguage,
    translate,
  ])

  // hide empty textarea
  useEffect(() => {
    if (textAreaRef.current !== null) {
      textAreaRef.current.style.height = '0px'
      if (result !== '') {
        textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px'
      }
    }
  }, [result, resultViewMode])

  // handle tts speak
  const handleSpeak = async () => {
    if (!ttsServiceInstanceKey) {
      throw new Error(t('translate.tts_not_configured'))
    }
    if (typeof result !== 'string') {
      throw new Error(t('errors.language_not_supported'))
    }
    await speakText(result, targetLanguage)
  }

  const handleTranslateBack = useCallback(async () => {
    if (typeof result !== 'string') {
      return
    }

    const id = crypto.randomUUID()
    translateID[index] = id
    setError('')
    setResultViewMode(null)

    const backTargetLanguage = sourceLanguage === 'auto' ? detectLanguage : sourceLanguage
    const backSourceLanguage = sourceLanguage === 'auto' ? 'auto' : targetLanguage
    const isPlugin = whetherPluginService(currentTranslateServiceInstanceKey)
    const setHideOnce = invokeOnce(setHide)
    setIsLoading(true)
    setHide(true)

    try {
      const value = await invokeTranslateService({
        instanceKey: currentTranslateServiceInstanceKey,
        text: result.trim(),
        from: backSourceLanguage,
        to: backTargetLanguage,
        detect: isPlugin ? detectLanguage : backSourceLanguage,
        serviceInstanceConfigMap,
        pluginServices: pluginList.translate,
        builtinServices: builtinServiceMap,
        onStream: (streamValue) => {
          if (translateID[index] !== id) return
          setResult(toTranslationResult(streamValue))
          setHideOnce(false)
        },
      })

      if (translateID[index] !== id) return
      const translatedText = toText(value).trim()
      setResult(value === result ? `${translatedText} ` : translatedText)
      setIsLoading(false)
      if (hasVisibleResult(value)) {
        setHideOnce(false)
      }
    } catch (error) {
      if (translateID[index] !== id) return
      setIsLoading(false)
      setHideOnce(false)
      if (error instanceof TranslateServiceInvocationError) {
        setError(
          error.code === 'language-not-supported'
            ? t('errors.language_not_supported')
            : getTranslateServiceNotConfiguredMessage(),
        )
        return
      }

      reportRuntimeError(error, {
        source: isPlugin ? 'translate_back.plugin' : 'translate_back.builtin',
        logMessage: isPlugin
          ? 'Translate-back plugin rejected.'
          : 'Translate-back provider rejected.',
        toastId: `translate_back.${isPlugin ? 'plugin' : 'builtin'}:${currentTranslateServiceInstanceKey}`,
        context: {
          service: currentTranslateServiceInstanceKey,
          from: backSourceLanguage || 'unknown',
          to: backTargetLanguage || 'unknown',
        },
      })
      setError(toErrorMessage(error))
    }
  }, [
    currentTranslateServiceInstanceKey,
    detectLanguage,
    getTranslateServiceNotConfiguredMessage,
    index,
    pluginList.translate,
    result,
    serviceInstanceConfigMap,
    sourceLanguage,
    t,
    targetLanguage,
  ])

  const canPreviewMarkdown =
    !isLoading && typeof result === 'string' && result !== '' && isMarkdownLike(result)
  const activeResultViewMode = resultViewMode ?? (canPreviewMarkdown ? 'markdown' : 'source')

  return (
    <Card shadow="none" className="rounded-[10px]">
      <CardHeader
        className={`flex justify-between py-1 px-0 bg-content2 h-7.5 ${hide ? 'rounded-[10px]' : 'rounded-t-[10px]'}`}
      >
        {/* current service instance and available service instance to change */}
        <div className="flex">
          <ServiceInstanceDropdown
            selectedKey={currentTranslateServiceInstanceKey}
            instanceKeys={translateServiceInstanceList}
            serviceInstanceConfigMap={serviceInstanceConfigMap}
            pluginServices={pluginList.translate}
            builtinServices={builtinServiceMap}
            getBuiltinLabel={(serviceName) => t(`services.translate.${serviceName}.title`)}
            ariaLabel={t('accessibility.translate_service')}
            onSelectionChange={setCurrentTranslateServiceInstanceKey}
            buttonVariant="solid"
            buttonClassName="bg-transparent"
            menuClassName="max-h-[40vh] overflow-y-auto"
          />
          {isLoading && <Spinner color="default" size="sm" className="my-auto ml-5" />}
        </div>
        {/* content collapse */}
        <div className="flex">
          <Button
            size="sm"
            isIconOnly
            variant="light"
            className="h-5 w-5"
            onPress={() => setHide(!hide)}
          >
            {hide ? (
              <BiExpandVertical className="text-[16px]" />
            ) : (
              <BiCollapseVertical className="text-[16px]" />
            )}
          </Button>
        </div>
      </CardHeader>
      <AnimatePresence initial={false}>
        {!hide && (
          <motion.div
            key="translation-result"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* result content */}
            <CardBody className={`p-3 pb-0 ${hide ? 'h-0 p-0' : ''}`}>
              {typeof result === 'string' ? (
                activeResultViewMode === 'markdown' && canPreviewMarkdown ? (
                  <MarkdownResult value={result} appFontSize={resolvedAppFontSize} />
                ) : (
                  <textarea
                    ref={textAreaRef}
                    className="h-0 w-full resize-none overflow-hidden bg-transparent select-text outline-none"
                    style={{ fontSize: resolvedAppFontSize }}
                    readOnly
                    value={result}
                  />
                )
              ) : (
                <div>
                  {result.pronunciations.length > 0 &&
                    result.pronunciations.map((pronunciation, pronunciationIndex) => {
                      const voice = pronunciation.voice
                      return (
                        <div key={`pronunciation-${pronunciationIndex}`}>
                          {pronunciation.region && (
                            <span
                              className="mr-3 text-default-500"
                              style={{ fontSize: resolvedAppFontSize }}
                            >
                              {pronunciation.region}
                            </span>
                          )}
                          {pronunciation.symbol && (
                            <span
                              className="mr-3 text-default-500"
                              style={{ fontSize: resolvedAppFontSize }}
                            >
                              {pronunciation.symbol}
                            </span>
                          )}
                          {isAudioData(voice) && (
                            <HiOutlineVolumeUp
                              className="my-auto inline-block cursor-pointer"
                              style={{ fontSize: resolvedAppFontSize }}
                              onClick={() => {
                                void playAudio(voice).catch((error) => {
                                  reportRuntimeError(error, {
                                    source: 'translate.pronunciation.tts',
                                    logMessage: 'Pronunciation audio playback failed.',
                                    toastId: 'translate.pronunciation.tts',
                                    context: {
                                      service: currentTranslateServiceInstanceKey,
                                    },
                                  })
                                })
                              }}
                            />
                          )}
                        </div>
                      )
                    })}
                  {result.explanations.length > 0 &&
                    result.explanations.map((explanations, explanationIndex) => {
                      return (
                        <div key={`explanation-${explanationIndex}`}>
                          {explanations.explains.length > 0 &&
                            explanations.explains.map((explain, index) => {
                              return (
                                <span key={`explain-${explanationIndex}-${index}`}>
                                  {index === 0 ? (
                                    <>
                                      <span
                                        className="mr-3 text-default-500"
                                        style={{ fontSize: resolvedAppFontSize - 2 }}
                                      >
                                        {explanations.trait}
                                      </span>
                                      <span
                                        className="font-bold select-text"
                                        style={{ fontSize: resolvedAppFontSize }}
                                      >
                                        {explain}
                                      </span>
                                      <br />
                                    </>
                                  ) : (
                                    <span
                                      className="mr-1 text-default-500 select-text"
                                      style={{ fontSize: resolvedAppFontSize - 2 }}
                                    >
                                      {explain}
                                    </span>
                                  )}
                                </span>
                              )
                            })}
                        </div>
                      )
                    })}
                  <br />
                  {result.associations.length > 0 &&
                    result.associations.map((association, associationIndex) => {
                      return (
                        <div key={`association-${associationIndex}`}>
                          <span
                            className="text-default-500"
                            style={{ fontSize: resolvedAppFontSize }}
                          >
                            {association}
                          </span>
                        </div>
                      )
                    })}
                  {result.sentence.length > 0 &&
                    result.sentence.map((sentence, index) => {
                      return (
                        <div key={`sentence-${index}`}>
                          <span className="mr-3" style={{ fontSize: resolvedAppFontSize - 2 }}>
                            {index + 1}.
                          </span>
                          <>
                            {sentence.source && (
                              <span
                                className="select-text"
                                style={{ fontSize: resolvedAppFontSize }}
                              >
                                {renderSafeRichText(sentence.source)}
                              </span>
                            )}
                          </>
                          <>
                            {sentence.target && (
                              <div
                                className="text-default-500 select-text"
                                style={{ fontSize: resolvedAppFontSize }}
                              >
                                {renderSafeRichText(sentence.target)}
                              </div>
                            )}
                          </>
                        </div>
                      )
                    })}
                </div>
              )}
              {error !== '' ? (
                error.split('\n').map((v) => {
                  return (
                    <p key={v} className="text-danger" style={{ fontSize: resolvedAppFontSize }}>
                      {v}
                    </p>
                  )
                })
              ) : (
                <></>
              )}
            </CardBody>
            <CardFooter
              className={`bg-content1 rounded-none rounded-b-[10px] flex px-3 p-1.25 ${hide ? 'hidden' : ''}`}
            >
              <ButtonGroup>
                {/* markdown preview toggle */}
                <Tooltip
                  content={
                    activeResultViewMode === 'markdown'
                      ? t('translate.show_source')
                      : t('translate.show_preview')
                  }
                >
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    className={!canPreviewMarkdown ? 'hidden' : ''}
                    isDisabled={!canPreviewMarkdown}
                    onPress={() => {
                      setResultViewMode(activeResultViewMode === 'markdown' ? 'source' : 'markdown')
                    }}
                  >
                    {activeResultViewMode === 'markdown' ? (
                      <MdCode className="text-[16px]" />
                    ) : (
                      <MdArticle className="text-[16px]" />
                    )}
                  </Button>
                </Tooltip>
                {/* speak button */}
                <Tooltip content={t('translate.speak')}>
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    isDisabled={typeof result !== 'string' || result === ''}
                    onPress={() => {
                      handleSpeak().catch((e) => {
                        reportRuntimeError(e, {
                          source: 'translate.target.tts',
                          logMessage: 'Target text TTS failed.',
                          toastId: 'translate.target.tts',
                          context: {
                            service: ttsServiceInstanceKey ?? 'none',
                            targetLanguage,
                          },
                        })
                      })
                    }}
                  >
                    <HiOutlineVolumeUp className="text-[16px]" />
                  </Button>
                </Tooltip>
                {/* copy button */}
                <Tooltip content={t('translate.copy')}>
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    isDisabled={typeof result !== 'string' || result === ''}
                    onPress={() => {
                      if (typeof result === 'string') {
                        writeClipboardText(result)
                      }
                    }}
                  >
                    <MdContentCopy className="text-[16px]" />
                  </Button>
                </Tooltip>
                {/* translate back button */}
                <Tooltip content={t('translate.translate_back')}>
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    isDisabled={typeof result !== 'string' || result === ''}
                    onPress={handleTranslateBack}
                  >
                    <TbTransformFilled className="text-[16px]" />
                  </Button>
                </Tooltip>
                {/* error retry button */}
                <Tooltip content={t('translate.retry')}>
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    className={error === '' ? 'hidden' : ''}
                    onPress={() => {
                      setError('')
                      setResult('')
                      setResultViewMode(null)
                      translate()
                    }}
                  >
                    <GiCycle className="text-[16px]" />
                  </Button>
                </Tooltip>
              </ButtonGroup>
            </CardFooter>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
