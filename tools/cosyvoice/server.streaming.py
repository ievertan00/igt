# Copyright (c) 2024 Alibaba Inc (authors: Xiang Lyu)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Patched for current cosyvoice API: inference_* expect prompt_wav as a FILE PATH
# (the frontend re-opens it several times), not a pre-loaded 16k tensor.
# Plus an extra /inference_zero_shot_stream endpoint (stream=True) for low-latency
# incremental playback; the original /inference_zero_shot stays non-streaming so it
# remains a stable fallback when streaming chunks crash the vocoder.
import os
import sys
import argparse
import logging
import tempfile
import hashlib
logging.getLogger('matplotlib').setLevel(logging.WARNING)
from fastapi import FastAPI, UploadFile, Form, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import numpy as np
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append('{}/../../..'.format(ROOT_DIR))
sys.path.append('{}/../../../third_party/Matcha-TTS'.format(ROOT_DIR))
from cosyvoice.cli.cosyvoice import AutoModel

app = FastAPI()
# set cross region allowance
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"])


def generate_data(model_output):
    for i in model_output:
        tts_audio = (i['tts_speech'].cpu().numpy() * (2 ** 15)).astype(np.int16).tobytes()
        yield tts_audio


def save_prompt_wav(prompt_wav):
    # current cosyvoice API re-opens the prompt wav multiple times, so persist it to a real path
    suffix = os.path.splitext(prompt_wav.filename or 'prompt.wav')[1] or '.wav'
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(prompt_wav.file.read())
    tmp.flush()
    tmp.close()
    return tmp.name


# Cache the (fixed) zero-shot prompt so its speech tokens + speaker embedding are
# extracted once instead of on every request. That extraction runs the speech
# tokenizer / campplus ONNX models on CPU (onnxruntime here has no CUDA provider),
# which was ~1s of fixed per-request overhead. Keyed on the prompt audio + text so a
# changed reference clip re-registers automatically.
_spk_cache = {}


def cached_zero_shot_spk(prompt_text, prompt_wav_path):
    with open(prompt_wav_path, 'rb') as f:
        key = hashlib.md5(f.read()).hexdigest() + ':' + hashlib.md5(prompt_text.encode('utf-8')).hexdigest()
    if key not in _spk_cache:
        cosyvoice.add_zero_shot_spk(prompt_text, prompt_wav_path, key)
        _spk_cache[key] = True
    return key


@app.get("/inference_sft")
@app.post("/inference_sft")
async def inference_sft(tts_text: str = Form(), spk_id: str = Form()):
    model_output = cosyvoice.inference_sft(tts_text, spk_id)
    return StreamingResponse(generate_data(model_output))


@app.get("/inference_zero_shot")
@app.post("/inference_zero_shot")
async def inference_zero_shot(tts_text: str = Form(), prompt_text: str = Form(), prompt_wav: UploadFile = File()):
    prompt_wav_path = save_prompt_wav(prompt_wav)
    spk = cached_zero_shot_spk(prompt_text, prompt_wav_path)
    model_output = cosyvoice.inference_zero_shot(tts_text, '', '', zero_shot_spk_id=spk)
    return StreamingResponse(generate_data(model_output))


@app.get("/inference_zero_shot_stream")
@app.post("/inference_zero_shot_stream")
async def inference_zero_shot_stream(tts_text: str = Form(), prompt_text: str = Form(), prompt_wav: UploadFile = File()):
    # stream=True: yields PCM chunks as they are generated, for low-latency playback.
    prompt_wav_path = save_prompt_wav(prompt_wav)
    spk = cached_zero_shot_spk(prompt_text, prompt_wav_path)
    model_output = cosyvoice.inference_zero_shot(tts_text, '', '', zero_shot_spk_id=spk, stream=True)
    return StreamingResponse(generate_data(model_output))


@app.get("/inference_cross_lingual")
@app.post("/inference_cross_lingual")
async def inference_cross_lingual(tts_text: str = Form(), prompt_wav: UploadFile = File()):
    prompt_wav_path = save_prompt_wav(prompt_wav)
    model_output = cosyvoice.inference_cross_lingual(tts_text, prompt_wav_path)
    return StreamingResponse(generate_data(model_output))


@app.get("/inference_instruct")
@app.post("/inference_instruct")
async def inference_instruct(tts_text: str = Form(), spk_id: str = Form(), instruct_text: str = Form()):
    model_output = cosyvoice.inference_instruct(tts_text, spk_id, instruct_text)
    return StreamingResponse(generate_data(model_output))


@app.get("/inference_instruct2")
@app.post("/inference_instruct2")
async def inference_instruct2(tts_text: str = Form(), instruct_text: str = Form(), prompt_wav: UploadFile = File()):
    prompt_wav_path = save_prompt_wav(prompt_wav)
    model_output = cosyvoice.inference_instruct2(tts_text, instruct_text, prompt_wav_path)
    return StreamingResponse(generate_data(model_output))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port',
                        type=int,
                        default=50000)
    parser.add_argument('--model_dir',
                        type=str,
                        default='iic/CosyVoice2-0.5B',
                        help='local path or modelscope repo id')
    args = parser.parse_args()
    # fp16=True: half-precision inference on the GPU — roughly halves latency and GPU
    # memory vs the fp32 default (which ran the card to ~97% full).
    cosyvoice = AutoModel(model_dir=args.model_dir, fp16=True)
    uvicorn.run(app, host="0.0.0.0", port=args.port)
