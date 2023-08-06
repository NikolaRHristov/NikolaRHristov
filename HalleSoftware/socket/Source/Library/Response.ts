// rome-ignore lint/suspicious/noExplicitAny:
export default async (message: any = null, status = 200) =>
	new Response(JSON.stringify(message), {
		status,
		headers: {
			"Content-Type": "application/json;charset=utf-8",
		},
	});
