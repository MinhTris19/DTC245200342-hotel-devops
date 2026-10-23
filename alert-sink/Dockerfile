FROM python:3.11-alpine
WORKDIR /app
RUN adduser -D -u 10001 appuser && mkdir -p /var/log/alerts && chown -R appuser:appuser /var/log/alerts /app
COPY server.py .
USER appuser
EXPOSE 8080
CMD ["python", "-u", "server.py"]
