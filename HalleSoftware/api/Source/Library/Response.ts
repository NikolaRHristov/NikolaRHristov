export default async (message: unknown = null, status = 200) =>
	new Response(JSON.stringify(message), {
		status,
		headers: {
			"Content-Type": "application/json;charset=utf-8",
		},
	});
