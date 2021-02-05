const BASE_URL = 'https://intranet.utsc.utoronto.ca/intranet2/RegistrarService?day='

exports.endpoint = function() {
	const date = new Date();

	const year = date.getUTCFullYear();
	const month = date.getUTCMonth();
	const day = date.getUTCDate();
	const url = BASE_URL + year + '-' + (month+1) + '-' + day;

	return {
		year: year,
		month: month,
		day: day,
		url: url
	}
}
