function openSnapshot(e) {
	var opener = $(this);
	opener.toggleClass("glyphicon-plus").toggleClass("glyphicon-minus");
	opener.parents("div.row").children(".repeat-snapshots").toggle();

	e.stopPropagation();
}

var last_click_row_number;
function selectRow(e) {
	var ele = $(this);
	var selector = ele.children("input.row-selector");
	var row_number = ele.prop("id").replace(/\D/g,"");

	if(!selector.prop("checked")) {
		selector.prop("checked", true);
		ele.addClass("selected");

		// Select all until last clicked snapshot.
		if(e.shiftKey) {
			var bigger = row_number;
			var smaller = last_click_row_number;
			if(bigger < smaller) {
				var temp = bigger;
				bigger = smaller;
				smaller = temp;
			}

			for(var j = smaller; j <= bigger; j++) {
				var element = $("#row-" + j);
				element.children("input.row-selector").prop("checked", true);
				element.addClass("selected");
			}
		}
	} else {
		selector.prop("checked", false);
		ele.removeClass("selected");
	}

	last_click_row_number = row_number;
}

function resizeWindow() {
	if($(window).width() < 600) {
		$('#date-changer').removeClass('btn-group').removeClass('btn-group-justified');
		$('#date-changer').addClass('btn-group-vertical');
	} else {
		$('#date-changer').addClass('btn-group').addClass('btn-group-justified');
		$('#date-changer').removeClass('btn-group-vertical');
	}
}


function pageInit() {
	$(".opener span").click(openSnapshot);

	$(".row").click(selectRow);
	// Hide the opener option for snapshots with just one snap.
	$(".opener").each(function(i, ele) {
		ele = $(ele);
		if(!ele.parents("div.row").children(".snapshot-count").length) {
			ele.hide();
		}
	});

	resizeWindow();
}

$(window).resize(resizeWindow);


$(pageInit);