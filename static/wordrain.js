function stopPropagation(event) {
    event.preventDefault();
    event.stopPropagation();
}

let example_words = [
    {word:"1", x:100, y:10, ymod:0, score:1},
    {word:"2", x:120, y:30, ymod:0, score:0.8},
    {word:"3", x:200, y:10, ymod:0, score:0.6},
    {word:"4", x:50, y:10, ymod:0, score:0.7},
    {word:"5", x:110, y:40, ymod:0.5, score:0.4},
    {word:"6", x:300, y:10, ymod:0, score:0.1},
]

function svgelement(name) {
    return $(document.createElementNS("http://www.w3.org/2000/svg", name));
}

function create_example() {
    $(".renderexample").css("display", "block");
    let example = $("svg g.example");
    for (let word of example_words) {
	let text = svgelement("text");
	text.addClass("example-" + word.word);
	text.css("font-family", "sans-serif");
	let lineup = svgelement("line");
	lineup.addClass("example-" + word.word);
	lineup.addClass("lineup");
	let linedown = svgelement("line");
	linedown.addClass("example-" + word.word);
	linedown.addClass("linedown");
	let lineup_circle = svgelement("circle");
	lineup_circle.addClass("example-" + word.word);
	lineup_circle.addClass("lineup");
	let linedown_circle = svgelement("circle");
	linedown_circle.addClass("example-" + word.word);
	linedown_circle.addClass("linedown");
	example.append(text);
	example.append(lineup);
	example.append(linedown);
	example.append(lineup_circle);
	example.append(linedown_circle);
    }
    example.find("line.lineup").attr("stroke", "#ff80ff");
    example.find("circle.lineup").attr("fill", "#ff80ff");
    example.find(".linedown").attr("stroke", "#ff80ff");
    example.find(".linedown").attr("opacity", "0.5");
    example.find("line.linedown").attr("stroke-width", "2");
    example.find("line.linedown").attr("y2", "0");
    example.find("circle.linedown").attr("stroke-width", "1");
    example.find("circle.linedown").attr("fill", "none");
    example.find("text").attr("alignment-baseline", "hanging");
    example.find("circle").attr("r", "5");
    redraw_example();
}

function redraw_example() {
    let falloff = parseFloat($("#falloff").val());
    let bar_ratio = parseFloat($("#barratio").val());
    $("#falloffdisplay").text(falloff);
    $("#barratiodisplay").text(Math.trunc(bar_ratio*100) + "%");
    console.log("redraw_example", falloff);
    for (let word of example_words) {
	let selector = ".example-" + word.word;
	$("text" + selector).attr("x", word.x);
	$("text" + selector).text("word");
	fontsize = Math.pow(word.score, falloff) * 20;
	let y = word.y + word.ymod * fontsize;
	console.log("redraw_example", word.word, word.score, fontsize);
	$("text" + selector).css("font-size", Math.max(5, fontsize) + "px");
	$("text" + selector).attr("y", y);

	let barheight_multiplier = bar_ratio*10;

	$("line" + selector).attr("x1", word.x);
	$("line" + selector).attr("x2", word.x);
	$("line" + selector).attr("y2", 0);
	$("line" + selector + ".lineup").attr("y1", -fontsize*barheight_multiplier);
	$("line" + selector + ".lineup").attr("stroke-width", Math.max(2, fontsize/5));
	$("circle" + selector).attr("cx", word.x);
	$("circle" + selector + ".lineup").attr("cy", -fontsize*barheight_multiplier);
	$("circle" + selector + ".linedown").attr("cy", y);
	$("line" + selector + ".linedown").attr("y1", y);
    }
}

$(document).ready(function(){
    $("input[type='file']#fileinput").change(function (event) {
        let files = event.target.files;
        console.log("files chosen");
        console.log(files);
        uploadFiles(files);
    });
    reload_uploaded();

    $(".disclose-after-language-select").hide();
    $(".disclose-after-upload").hide();

    $("#languageselect").change(function (event) {
	if ($("#languageselect").val() != "") {
	    $(".disclose-after-language-select").show();
	} else {
	    $(".disclose-after-language-select").hide();
	}
	$("#fileinput")[0].value = "";
	$(".uploadprogress").empty();
	$(".downloadprogress").empty();
	$("object.inlinepdf").remove();
    });

    $(".buttonwrapper").hide();
    $("#fileinput").addClass("hidefilename");
    $(".disclosebutton").click(function (event) {
	let disclose = $(event.target).parent(".disclose");
	disclose.toggleClass("disclosed");
    });
    $(".disclosebutton").parent(".disclose").removeClass("disclosed");

    create_example();
    $("#falloff, #barratio").bind("input", redraw_example);
});

let pdf_aspect_ratio;

async function download_result(jq) {
    console.log("downloading");
    let lang = $("#languageselect").val();
    let falloff = $("#falloff").val();
    let bar_ratio = $("#barratio").val();
    try {
	var ajaxdata = new FormData();
        ajaxdata.append("id", result_id);
        ajaxdata.append("vectorization", vectorization);
        ajaxdata.append("lang", lang);
        ajaxdata.append("falloff", falloff);
        ajaxdata.append("barratio", bar_ratio);

	let response = await fetch("download",{
	    body:ajaxdata,
	    method: "POST"});
	if (!response.ok) {
	    jq.find(".processing-progress").after("<span>Download failed</span>");
	    jq.find(".processing-progress").remove();
	    return;
	}
	
	pdf_aspect_ratio = parseFloat(response.headers.get("X-Aspect-Ratio"));
	console.log(pdf_aspect_ratio);
	let blob = await response.blob();

	const url = URL.createObjectURL(blob);
	let downloadlink = $("<a download>Download PDF</a>");
	downloadlink.attr("href", url);
	downloadlink.css("margin-right", "2em");
	jq.append(downloadlink);
	
	let openlink = $("<a>Open PDF in new tab</a>");
	openlink.attr("href", url);
	openlink.attr("target", "_blank");
	jq.append(openlink);
	
	jq.find(".processing-progress").remove();
	let inlinepdf = $("<object class='inlinepdf'></object>");
	inlinepdf.attr("data", url);
	$("main").append(inlinepdf);
	inlinepdf.css("height", (pdf_aspect_ratio*100)+"vw");
	$("#fileinput")[0].value = "";
    } catch (error) {
	jq.find(".processing-progress").after("<span>Download failed</span>");
	jq.find(".processing-progress").remove();
    }
}

function reload_uploaded() {
    $(".downloadprogress").empty();
    if (result_id) {
	$(".buttonwrapper").show();
	$(".buttonwrapper").off('click');
	$(".disclose-after-upload").show();
	$(".buttonwrapper").click(function (event) {
	    $("object.inlinepdf").remove();
	    $(".downloadprogress").empty();
	    stopPropagation(event);
	    $(".downloadprogress").append("<div class='processing-progress'>Processing...<progress></progress></div>");
	    download_result($(".downloadprogress"));
	});
    }
}

let result_id = null;
let vectorization = null;

async function uploadFiles(files) {
    var ajaxdata = new FormData();

    $("object.inlinepdf").remove();
    
    $.each(files, function (i, file) {
        console.log("uploading");
        console.log(file);
        ajaxdata.append("file", file);
    });
    $.each($("#backgroundcorpus")[0].files, function(i, file) {
	ajaxdata.append("backgroundcorpora", file);
    });
    ajaxdata.append("nwords", $("#nwords").val());
    ajaxdata.append("ngrams", document.getElementById("ngrams").checked ? "on" : "");
    ajaxdata.append("idf", document.getElementById("idf").checked ? "on" : "");

    ajaxdata.append("lang", $("#languageselect").val());
    console.log("uploading " + ajaxdata);
    $(".uploadprogress").empty();
    $(".uploadprogress").append("<div class='processing-progress'><span class='uploadingtext'>Uploading...</span><progress></progress></div>");

    var jqxhr = $.ajax({
        url: "upload",
        type: "POST",
        data: ajaxdata,
        dataType: 'text',
        cache: false,
        contentType: false,
        processData: false,
        success: function (data, textStatus, xhr) {
	    result_id = xhr.getResponseHeader("X-WR-Signature");
	    vectorization = data;
	    $(".processing-progress progress").attr("max", 100).attr("value", 100);
	    $(".processing-progress .uploadingtext").text("Uploaded");
            reload_uploaded();
            console.log(data);
        },
        error: function (error) {
	    $(".uploadprogress").empty();
	    $(".downloadprogress").empty();

            console.log(error);
            console.log(error.responseText);
	    if (error.status == 415) {
		$(".uploadprogress").append("<div class='processing-progress'>Upload failed: unsupported file type</div>");
	    } else {
		$(".uploadprogress").append("<div class='processing-progress'>Upload failed</div>");
	    }
        },
        xhr: function () {
            let xhr = $.ajaxSettings.xhr();
            if (xhr.upload) {
                xhr.upload.addEventListener("progress", (e) => {
                    let percent = Math.round(e.loaded / e.total * 100);
		    if (percent == 100) {
			$(".processing-progress progress").attr("max", null).attr("value", null);
		    } else {
			$(".processing-progress progress").attr("max", e.total).attr("value", e.loaded);
		    }

                    console.log(e.loaded + "/" + e.total);
                });
		xhr.upload.addEventListener("loadstart", (event) => {
                    console.log("Start uploading");
		});
            }
            return xhr;
        }
    });

}
