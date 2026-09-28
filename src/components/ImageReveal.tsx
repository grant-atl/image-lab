import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { MetalFx } from 'metal-fx'
import { EFFECTS, getAnimationSpeed, getRevealProgress, REVEAL_FRAGMENT_SHADER, REVEAL_VERTEX_SHADER, type EffectId } from '../lib/reveals'

export type ImageRevealProps = {
  src: string
  alt?: string
  effect?: EffectId
  duration?: number
  speed?: number
  intensity?: number
  color?: string
  loading?: boolean
  loop?: boolean
  progress?: number
  paused?: boolean
  className?: string
  onError?: (message: string) => void
}

class MetalFxBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? null : this.props.children }
}

/** A GPU image loader. Set loading=false when your generated image is ready. */
export function ImageReveal({
  src, alt = 'Image preview', effect = 'pixel-mosaic', duration = 3, speed = 1,
  intensity = 0.6, color = '#baff66', loading = false, loop = false,
  progress, paused = false, className = '', onError,
}: ImageRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const metalLayerRef = useRef<HTMLDivElement>(null)
  const metalOpacity = useRef(1)
  const [metalVisible, setMetalVisible] = useState(false)
  const optionsRef = useRef({ src, effect, duration, speed, intensity, color, loading, loop, progress, paused, onError })
  const updateRef = useRef<((sourceChanged: boolean, restart: boolean) => void) | null>(null)
  const reportRef = useRef<((message: string) => void) | null>(null)
  const [fallback, setFallback] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const before = optionsRef.current
    optionsRef.current = { src, effect, duration, speed, intensity, color, loading, loop, progress, paused, onError }
    updateRef.current?.(before.src !== src, before.effect !== effect || before.loading !== loading || before.loop !== loop)
  }, [src, effect, duration, speed, intensity, color, loading, loop, progress, paused, onError])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = motion.matches
    let visible = false
    let disposed = false
    let failed = false
    let contextLost = false
    let gl: WebGLRenderingContext | null = null
    let program: WebGLProgram | null = null
    let buffer: WebGLBuffer | null = null
    let texture: WebGLTexture | null = null
    let image: HTMLImageElement | null = null
    let imageLoaded = false
    let imageWidth = 1, imageHeight = 1
    let frame = 0, previousTime = 0, elapsed = 0, animationTime = 0
    let uniforms: Record<string, WebGLUniformLocation | null> = {}
    let colorValue = new Float32Array([186 / 255, 1, 102 / 255])
    let lastColor = ''

    function stop() {
      cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
    }

    function release() {
      stop()
      if (image) {
        image.onload = null
        image.onerror = null
        image = null
      }
      if (gl) {
        gl.deleteBuffer(buffer)
        gl.deleteTexture(texture)
        gl.deleteProgram(program)
      }
      buffer = null
      texture = null
      program = null
      gl = null
      imageLoaded = false
    }

    function report(message: string) {
      if (disposed) return
      failed = true
      stop()
      setFallback(true)
      setError(message)
      optionsRef.current.onError?.(message)
    }
    reportRef.current = report

    function requestDraw() {
      if (!disposed && visible && !document.hidden && !reducedMotion && !failed && !contextLost && gl && !frame) {
        frame = requestAnimationFrame(draw)
      }
    }

    function loadImage() {
      if (!gl || !texture) return
      if (image) {
        image.onload = null
        image.onerror = null
      }
      imageLoaded = false
      elapsed = 0
      previousTime = 0
      setError(null)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([16, 18, 17, 255]))
      if (!optionsRef.current.src.trim()) {
        image = null
        requestDraw()
        return
      }
      const next = new window.Image()
      image = next
      next.crossOrigin = 'anonymous'
      next.decoding = 'async'
      next.onload = () => {
        if (disposed || image !== next || !gl || !texture) return
        try {
          gl.bindTexture(gl.TEXTURE_2D, texture)
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
          const limit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 4096)
          const textureWidth = Math.min(limit, 2 ** Math.ceil(Math.log2(next.naturalWidth)))
          const textureHeight = Math.min(limit, 2 ** Math.ceil(Math.log2(next.naturalHeight)))
          let pixels: TexImageSource = next
          // WebGL 1 needs power-of-two textures for the filtered blur pyramid.
          if (next.naturalWidth !== textureWidth || next.naturalHeight !== textureHeight) {
            const scaled = document.createElement('canvas')
            scaled.width = textureWidth
            scaled.height = textureHeight
            const context = scaled.getContext('2d')
            if (!context) throw new Error('Image could not be resized.')
            context.drawImage(next, 0, 0, scaled.width, scaled.height)
            pixels = scaled
          }
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
          gl.generateMipmap(gl.TEXTURE_2D)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
          if (gl.getError() !== gl.NO_ERROR) throw new Error('Image could not be uploaded.')
          imageWidth = next.naturalWidth
          imageHeight = next.naturalHeight
          imageLoaded = true
          elapsed = 0
          previousTime = 0
          setFallback(reducedMotion)
          requestDraw()
        } catch {
          report('This image cannot be animated. Showing the original image.')
        }
      }
      next.onerror = () => report('Image preview unavailable. Check the image source.')
      next.src = optionsRef.current.src
      requestDraw()
    }

    function initialize() {
      if (disposed || gl || failed || contextLost || reducedMotion || !visible) return
      try {
        gl = canvas!.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
        if (!gl) {
          failed = true
          setFallback(true)
          optionsRef.current.onError?.('WebGL is unavailable. Showing a still image.')
          return
        }
        const context = gl
        const compile = (type: number, source: string) => {
          const shader = context.createShader(type)
          if (!shader) throw new Error('Could not create the image effect.')
          context.shaderSource(shader, source)
          context.compileShader(shader)
          if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
            const message = context.getShaderInfoLog(shader) || 'The image effect could not compile.'
            context.deleteShader(shader)
            throw new Error(message)
          }
          return shader
        }
        const vertex = compile(context.VERTEX_SHADER, REVEAL_VERTEX_SHADER)
        let fragment: WebGLShader
        try {
          fragment = compile(context.FRAGMENT_SHADER, REVEAL_FRAGMENT_SHADER)
        } catch (cause) {
          context.deleteShader(vertex)
          throw cause
        }
        program = context.createProgram()
        if (!program) {
          context.deleteShader(vertex)
          context.deleteShader(fragment)
          throw new Error('Could not create the image effect.')
        }
        context.attachShader(program, vertex)
        context.attachShader(program, fragment)
        context.linkProgram(program)
        context.deleteShader(vertex)
        context.deleteShader(fragment)
        if (!context.getProgramParameter(program, context.LINK_STATUS)) throw new Error('Could not start the image effect.')
        context.useProgram(program)
        buffer = context.createBuffer()
        texture = context.createTexture()
        if (!buffer || !texture) throw new Error('Could not prepare the image effect.')
        context.bindBuffer(context.ARRAY_BUFFER, buffer)
        context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), context.STATIC_DRAW)
        const position = context.getAttribLocation(program, 'aPosition')
        context.enableVertexAttribArray(position)
        context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0)
        context.activeTexture(context.TEXTURE0)
        context.bindTexture(context.TEXTURE_2D, texture)
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR)
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR)
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE)
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE)
        uniforms = Object.fromEntries(['uTexture', 'uResolution', 'uImageSize', 'uColor', 'uTime', 'uProgress', 'uIntensity', 'uEffect'].map(name => [name, context.getUniformLocation(program!, name)]))
        context.uniform1i(uniforms.uTexture, 0)
        loadImage()
      } catch (cause) {
        release()
        report(cause instanceof Error ? cause.message : 'The image effect is unavailable.')
      }
    }


    function draw(timestamp: number) {
      frame = 0
      if (!gl || !program || disposed || !visible || document.hidden || reducedMotion || failed || contextLost) return
      const options = optionsRef.current
      const motionSpeed = getAnimationSpeed(options.speed)
      const delta = !options.paused && previousTime ? Math.min((timestamp - previousTime) / 1000, 0.1) : 0
      previousTime = options.paused ? 0 : timestamp
      animationTime += delta * motionSpeed
      if (imageLoaded) elapsed += delta
      const controlled = typeof options.progress === 'number' && Number.isFinite(options.progress)
      const amount = !imageLoaded ? 0 : controlled ? Math.max(0, Math.min(1, options.progress!)) : options.loading ? 0 : getRevealProgress(elapsed, options.duration, options.loop)
      metalOpacity.current = 1 - amount * amount * (3 - 2 * amount)
      if (metalLayerRef.current) metalLayerRef.current.style.opacity = String(metalOpacity.current)
      setMetalVisible(options.effect === 'liquid-metal' && amount < 1)
      const ratio = Math.min(window.devicePixelRatio || 1, 1.75)
      const width = Math.max(1, Math.round(canvas!.clientWidth * ratio))
      const height = Math.max(1, Math.round(canvas!.clientHeight * ratio))
      if (canvas!.width !== width || canvas!.height !== height) {
        canvas!.width = width
        canvas!.height = height
      }
      if (lastColor !== options.color) {
        lastColor = options.color
        const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(options.color)?.[1]
        if (hex) {
          const full = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex
          colorValue = new Float32Array([0, 2, 4].map(offset => parseInt(full.slice(offset, offset + 2), 16) / 255))
        }
      }
      gl.uniform2f(uniforms.uImageSize, imageWidth, imageHeight)
      gl.uniform3fv(uniforms.uColor, colorValue)
      gl.uniform1f(uniforms.uTime, animationTime)
      gl.uniform1f(uniforms.uProgress, amount)
      const strength = Number.isFinite(options.intensity) ? Math.max(0, Math.min(1, options.intensity)) : 0.6
      gl.uniform1f(uniforms.uIntensity, strength)
      gl.uniform1i(uniforms.uEffect, Math.max(0, EFFECTS.findIndex(item => item.id === options.effect)))
      gl.viewport(0, 0, width, height)
      gl.uniform2f(uniforms.uResolution, width, height)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      const advanceReveal = imageLoaded && !controlled && !options.loading && (options.loop || amount < 1)
      if (!options.paused && (advanceReveal || (options.effect !== 'liquid-metal' && motionSpeed > 0 && amount < 1))) requestDraw()
    }

    updateRef.current = (sourceChanged, restart) => {
      if (sourceChanged) {
        failed = false
        setError(null)
        setFallback(reducedMotion)
        if (gl) loadImage()
      }
      if (restart) {
        elapsed = 0
      }
      previousTime = 0
      initialize()
      requestDraw()
    }

    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting
      if (visible) {
        initialize()
        requestDraw()
      } else stop()
    })
    observer.observe(canvas)
    const resize = new ResizeObserver(() => requestDraw())
    resize.observe(canvas)
    const onVisibility = () => {
      if (document.hidden) stop()
      else requestDraw()
    }
    const onMotion = () => {
      reducedMotion = motion.matches
      setFallback(reducedMotion || failed)
      if (reducedMotion) stop()
      else {
        initialize()
        requestDraw()
      }
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      contextLost = true
      release()
      setFallback(true)
    }
    const onContextRestored = () => {
      contextLost = false
      failed = false
      elapsed = 0
      initialize()
      requestDraw()
    }
    document.addEventListener('visibilitychange', onVisibility)
    motion.addEventListener('change', onMotion)
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)
    if (reducedMotion) setFallback(true)

    return () => {
      disposed = true
      updateRef.current = null
      reportRef.current = null
      observer.disconnect()
      resize.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      motion.removeEventListener('change', onMotion)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      const context = gl
      release()
      context?.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [REVEAL_VERTEX_SHADER, REVEAL_FRAGMENT_SHADER])

  return (
    <div className={`image-reveal ${className}`} aria-busy={loading && !fallback} style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%', background: '#101211' }}>
      <canvas ref={canvasRef} role="img" aria-label={alt} aria-hidden={fallback} style={{ display: 'block', width: '100%', height: '100%', visibility: fallback ? 'hidden' : 'visible' }} />
      {effect === 'liquid-metal' && metalVisible && !fallback && <div ref={metalLayerRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: '#272727', opacity: metalOpacity.current, pointerEvents: 'none' }}>
        <MetalFxBoundary onError={() => reportRef.current?.('The metal effect is unavailable. Showing the original image.')}>
          <MetalFx preset="chromatic" strength={1} theme="dark" borderRadius={4} paused={paused || getAnimationSpeed(speed) === 0} style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '100%', height: '100%' }} />
          </MetalFx>
        </MetalFxBoundary>
      </div>}
      {fallback && src.trim() && <img src={src} alt={alt} loading="lazy" onError={() => setError('Image preview unavailable. Check the image source.')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      {error && <span role="status" style={{ position: 'absolute', bottom: 12, left: 12, right: 12, padding: '8px 10px', borderRadius: 4, background: 'rgba(16,18,17,.88)', color: '#ddd', font: '12px/1.4 sans-serif' }}>{error}</span>}
    </div>
  )
}
