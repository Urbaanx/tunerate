# Use conda-forge packages so lightfm is installed as a binary (no local build)
FROM continuumio/miniconda3:latest

WORKDIR /app

# copy environment file and create conda env
COPY environment.yml .

RUN conda env create -f environment.yml \
    && conda clean -afy

# use conda run to execute commands inside the env
SHELL ["conda", "run", "-n", "tunerate", "/bin/bash", "-lc"]

COPY . .

EXPOSE 8001

CMD ["conda", "run", "--no-capture-output", "-n", "tunerate", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]