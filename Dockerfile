FROM continuumio/miniconda3:latest

WORKDIR /app

COPY environment.yml .

RUN conda env create -f environment.yml \
    && conda clean -afy

SHELL ["conda", "run", "-n", "tunerate", "/bin/bash", "-lc"]

COPY . .

EXPOSE 8001

CMD ["conda", "run", "--no-capture-output", "-n", "tunerate", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]