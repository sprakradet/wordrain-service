Word Rain Web Service
=====================

Word Rain
---------

Word Rain is a novel approach to the classic word cloud that uses word
embeddings to position the words, thereby making it useful for
exploring the word content of a text or corpus.


Word Rain Web Service
---------------------

This web service makes it easy for users to generate their own word
rains without having to setup the Word Rain code themselves.

The web service is currently available at [wordrain.isof.se](https://wordrain.isof.se).


Setting up the service
----------------------

### Fetching the Word Rain Web Service code

Check out the Word Rain Web Service code:

`git clone https://github.com/sprakradet/wordrain-service`

Go down into the Word Rain Web Service directory:

`cd wordrain-service`

### Install the required Python packages

If you are using pip, run the following command to install all the
required packages:

```
pip install -r requirements.txt
```

If you are using conda:

```
conda install numpy
conda install scipy
conda install scikit-learn
conda install gensim
conda install nltk
conda install matplotlib
conda install -c conda-forge python-bidi
conda install reportlab
```


### Fetching additional code

Download JQuery 3.7.1 and put it in the directory `static`:

`curl -o static/jquery-3.7.1.min.js https://code.jquery.com/jquery-3.7.1.min.js`

### Configuring a secret

Change the string `@GENERATED_SECRET@` in config.py to something only
you know. If you have openssl installed, a convenient way to generate
a secret is to use the command:

`openssl rand -base64 21`

Make sure to use quotation marks (`"`) around the secret.

### Fetching the Word Rain main code

Check out the Word Rain repository from
https://github.com/CDHUppsala/word-rain:

```
git clone https://github.com/CDHUppsala/word-rain
```

Make a symbolic link from the Word Rain repository directory
`wordrain` into the Word Rain Web Service directory:

```
ln -s word-rain/wordrain wordrain
```


Make a symbolic link from the Word Rain repository directory `fonts`
into the Word Rain Web Service directory:

```
ln -s word-rain/fonts fonts
```


### Get a word2vec word space model

Download a word2vec model (for example a model for English from
[Huggingface](https://huggingface.co/fse/word2vec-google-news-300))
and put it in the Word Rain Web Service directory.

The example config.py uses `model-en.bin`, so change the filename in
config.py to the filename you use (and the language code if you use a
different language than English). If you use several models, add them
all to config.py.

Then create an index for the model (if your model is named `model-en.bin`):

```
python3 wordrain/wordspaceindex.py model-en.bin
```

If you use several models, repeat this command for all models.

### Stop word lists

A stop word list for English is already configured in the config.py
example.

For other languages than English, configure the stop word list in
config.py either by specifying the language name from the nltk stop
word list database, or write a Python expression that lists all stop
words for that language. A configuration that reads a stop
word list from a file could for example look like this:

```
stopwords = {
    "en": list(open("stopwords-en.txt", "rt", encoding="utf-8")),
}
```

### Add languages to index.html

If you have configured other languages than English, edit the
`templates/index.html` to reflect the languages that can be chosen.

In the `select` with id `languageselect`, add one row of `option` per
language with `value` set to the language code.


Testing the service
-------------------

To test the service on your local machine, run the test server like
this:

```
python wordrainservice.py
```

Never use this in a production environment. Instead, follow the
instructions in the next section.


Deploying the service
---------------------

Point your web server to the wordrainservice.wsgi file in the Word
Rain web service directory. You might have to install WSGI support in
your web server if this is not already included.


Privacy
-------

The Word Rain Web Service is designed to store as little information
as possible about the submitted text. However, temporary files might
still be created when receiving the texts. The current code uses
flask, which in turn uses werkzeug to parse the HTTP data, where the
current default is that files larger than 500KB will be written to
disk. To avoid writing files to disk, a custom `stream_factory` can be
used, but code for this is not included at the moment.

The standard (JavaScript based) interface uses a two-phase API. To
avoid storing any information on the server between the two phases,
the whole context is sent to the web browser, and then sent back in
the second phase. This data is signed by the above-mentioned secret to
prevent any attacks where the context is manipulated.


Security
--------

The Word Rain Web Service tries to trust submitted data as little as
possible, but it is difficult to be certain of the security properties
of the underlying libraries. Therefore, if run on Linux with AppArmor,
the service tries to change its AppArmor profile to "wordrain". If you
use AppArmor, make sure a profile by that name exists that is as
restrictive as possible.

The service needs to be able to create
temporary files in the `os.environ['TMPDIR']` directory, but otherwise
needs no write permissions except the WSGI sockets (consult your web
server documentation for the location).

Read permissions should only be necessary in the service's own
directory and system library directories. On some Linux systems,
Python has to be able to execute `/usr/bin/uname`, `/usr/bin/lscpu`,
and read in many parts of `/proc` and `/sys` to be able to count the number of
CPU:s, something that is necessary for some of the libraries.


Funding
-------

The Word Rain Web Service is published by the Institute for Language
and Folklore as a part of the CLARIN Knowledge Centre for the
Languages of Sweden (SWELANG). This work is funded by [Nationella Språkbanken](https://www.sprakbanken.se): The National Language Bank of Sweden (Swedish Research Council, 2017-00626).
