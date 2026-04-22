class EnsureCorsCredentialsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        allow_origin = response.get("Access-Control-Allow-Origin")
        if allow_origin and allow_origin != "*":
            response["Access-Control-Allow-Credentials"] = "true"

        return response
