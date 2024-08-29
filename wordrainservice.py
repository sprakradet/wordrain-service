import json
import importlib
from flask import Flask, request, redirect, \
     render_template, Blueprint, send_from_directory, Response, abort
from werkzeug.wsgi import FileWrapper
from nltk.corpus import stopwords
import concurrent.futures

from wordrain import wordspace, generate_wordrain
import wordrain

import config

print("starting wordrainservice")

file_type_plugin_modules = []

for module_name in config.file_type_plugins:
    plugin_module = importlib.import_module(module_name)
    file_type_plugin_modules.append(plugin_module)

wordrain.choose_fonts(config.fonts)

def load_wordspace(filename):
    space = wordspace.map_word2vec(filename)
    print("loaded: %s" % (filename,))
    return space

word2vec_models = {}
all_stopwords = {}

executor = concurrent.futures.ThreadPoolExecutor()
for lang, wordspace_filename in config.wordspaces.items():
    word2vec_models[lang] = executor.submit(load_wordspace, wordspace_filename)
    stopword_source = config.stopwords.get(lang)
    if stopword_source is None:
        all_stopwords[lang] = []
    elif isinstance(stopword_source, str):
        all_stopwords[lang] = list(set(stopwords.words(stopword_source)))
    else:
        all_stopwords[lang] = list(set([word.rstrip("\n") for word in stopword_source]))
executor.shutdown(wait=False)

bp = Blueprint('rtb', __name__, url_prefix='/')

def confine():
    try:
        apparmor = open("/proc/thread-self/attr/apparmor/current", "wt")
        print("changeprofile wordrain", file=apparmor)
        apparmor.close()
    except FileNotFoundError:
        pass

@bp.route('/', methods=['GET'])
def start_page():
    print("index")
    return render_template('index.html')

@bp.route('/static/<filename>')
def static_files(filename):
    return send_from_directory("static/", filename)


def read_file(f):
    corpus_text_chunks = []
    while True:
        chunk = f.read(32*1024)
        if len(chunk) == 0:
            break
        corpus_text_chunks.append(chunk)
    return corpus_text_chunks

@bp.route('/post', methods=['POST'])
def submission():
    confine()
    print(dict(request.form))
    lang = request.form.get("lang", "sv")
    if lang not in word2vec_models:
        return "Language not found", 400
    idf = request.form.get("idf", "") == "on"
    enable_ngrams = request.form.get("ngrams", "") == "on"
    falloff = float(request.form.get("falloff", "0.9"))
    barratio = float(request.form.get("barratio", "0.33"))
    files = request.files.getlist('file')
    corpus_texts = []
    for i, file in enumerate(files):
        corpus_text_chunks = read_file(file)
        corpus_text_binary = b"".join(corpus_text_chunks)
        corpus_texts.append(("%d" % i, get_text_from_file(corpus_text_binary)))
    rtl_text = lang in ["yi"]
    if enable_ngrams:
        ngrams = (1,2)
    else:
        ngrams = (1,1)
    images, cropboxes = generate_wordrain.generate_clouds(None, word2vec_models[lang].result(), None, stopwords = all_stopwords[lang], ngrams=ngrams, nr_of_words_to_show=300, idf=idf, add_title=False, fontpath="SourceSans3-Regular.otf", fontsize_falloff_rate=falloff, bar_ratio=barratio, nr_of_vertical_lines=0, min_tf_in_corpora=2, min_f_in_current_document=2, corpus_texts=corpus_texts, unified_graph=True, compact=True, rtl_text=rtl_text)
    print("sending image")
    x,y,w,h = cropboxes[0]
    aspect_ratio = h / w
    fw = FileWrapper(images[0])
    response = Response(fw, mimetype="application/pdf", direct_passthrough=True)
    response.cache_control.max_age = 1
    response.headers["X-Aspect-Ratio"] = "%.02f" % aspect_ratio
    print("finished")
    return response


import hmac

def json_dump(json_object):
    return json.dumps(json_object, separators=(',', ':'), sort_keys=True).encode("utf-8")

def get_signature(s):
    h = hmac.new(config.signature_secret.encode("ASCII"), None, "SHA256")
    h.update(s)
    return h.hexdigest()

def get_text_from_file(data):
    for file_type_plugin_module in file_type_plugin_modules:
        result = file_type_plugin_module.extract_text(data)
        if result is not None:
            return result
    return data.decode("utf-8", errors='ignore')

@bp.route('/upload', methods=['POST'])
def upload_file():
    confine()
    print(repr(request.form))
    print(repr(request.files).encode("utf-8"))
    lang = request.form.get("lang", "sv")
    if lang not in word2vec_models:
        return "Language not found", 400
    nwords = int(request.form.get("nwords", "300"))
    idf = request.form.get("idf", "") == "on"
    enable_ngrams = request.form.get("ngrams", "") == "on"
    files = request.files.getlist('file')
    backgroundcorpora = request.files.getlist('backgroundcorpora')
    background_corpus = []
    corpus_texts = []
    filenames = []
    for i, file in enumerate(files):
        corpus_text_chunks = read_file(file)
        filenames.append(file.filename)
        corpus_text_binary = b"".join(corpus_text_chunks)
        corpus_texts.append(("%d" % i, get_text_from_file(corpus_text_binary)))
    for i, file in enumerate(backgroundcorpora):
        corpus_text_chunks = read_file(file)
        corpus_text_binary = b"".join(corpus_text_chunks)
        background_corpus.append(get_text_from_file(corpus_text_binary))

    if enable_ngrams:
        ngrams = (1,2)
    else:
        ngrams = (1,1)
    params = generate_wordrain.Params(stopwords = all_stopwords[lang], ngrams=ngrams, nr_of_words_to_show=nwords, idf=idf, min_tf_in_corpora=2, min_f_in_current_document=2, background_corpus=background_corpus)
    word_info_matrix, new_words_lists, min_x, max_x, names = generate_wordrain.generate_clouds_vectorize(None, word2vec_models[lang].result(), None, params, corpus_texts=corpus_texts)
    vectorization = {"word_info_matrix":word_info_matrix, "new_words_lists":[list(l) for l in new_words_lists], "min_x": min_x, "max_x": max_x, "names": names}
    vectorization_text = json_dump(vectorization)
    signature = get_signature(vectorization_text)
    response = Response(vectorization_text, mimetype="text/plain")
    response.cache_control.max_age = 1
    response.headers["X-WR-Signature"] = signature
    print("sent signature", signature)
    response.headers["X-WR-Filename"] = filenames[0]
    return response

from wordrain.color import full_spectrum_map

@bp.route('/download', methods=['POST'])
def download_pdf():
    confine()
    id = request.form["id"]
    lang = request.form["lang"]
    falloff = float(request.form.get("falloff", "0.9"))
    barratio = float(request.form.get("barratio", "0.33"))
    lang = request.form["lang"]
    vectorization_text = request.form["vectorization"]
    signature = get_signature(vectorization_text.encode("utf-8"))
    print("received signature", id)
    print("calculated signature", signature)
    if id != signature:
        abort(400)
    vectorization = json.loads(vectorization_text)
    rtl_text = lang in ["yi"]
    params = generate_wordrain.Params(add_title=False, fontsize_falloff_rate=falloff, bar_ratio=barratio, nr_of_vertical_lines=0, unified_graph=True, compact=True, rtl_text=rtl_text, color_map=full_spectrum_map)
    word_info_matrix = vectorization["word_info_matrix"]
    new_words_lists = vectorization["new_words_lists"]
    min_x = vectorization["min_x"]
    max_x = vectorization["max_x"]
    names = vectorization["names"]
    images, cropboxes = generate_wordrain.generate_plot(None, generate_wordrain.word_info_restore(word_info_matrix), new_words_lists, min_x, max_x, names, params)
    x,y,w,h = cropboxes[0]
    aspect_ratio = h / w

    fw = FileWrapper(images[0])
    response = Response(fw, mimetype="application/pdf", direct_passthrough=True)
    response.cache_control.max_age = 1
    response.headers["X-Aspect-Ratio"] = "%.02f" % aspect_ratio
    return response


@bp.route('/post', methods=['GET'])
def submission_landing():
    return redirect("/")

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1000 * 1000
app.register_blueprint(bp)

if __name__ == '__main__':
    from werkzeug.serving import WSGIRequestHandler
    WSGIRequestHandler.protocol_version = "HTTP/1.1"
    app.run(debug=False)
